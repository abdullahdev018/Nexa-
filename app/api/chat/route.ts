import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { getProvider } from '@/lib/ai'
import { canUseModel, getModel } from '@/lib/ai/models'
import { buildSystemPrompt, deriveTitle, trimHistory } from '@/lib/ai/prompt'
import { IMAGE_TYPES, type Attachment, type ChatMessage } from '@/lib/ai/types'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

// Generation can take minutes on the deepest tier; the default function
// timeout would cut the stream off partway.
export const maxDuration = 300

/** Images cost the most to carry, so they are capped hardest. */
const MAX_ATTACHMENTS = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_CHARS = 200_000

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['image', 'text']),
  data: z.string().min(1),
  mediaType: z.string().max(120),
  size: z.number().int().nonnegative(),
})

const chatSchema = z.object({
  conversationId: z.string().min(1).max(40).nullable().optional(),
  // Empty is allowed when files are attached — "summarise this" with nothing
  // typed is a reasonable thing to do.
  message: z.string().max(100_000),
  model: z.string().max(40).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
})

/** Drops anything oversized or of an unsupported type rather than failing the turn. */
function sanitiseAttachments(input: z.infer<typeof attachmentSchema>[] | undefined): Attachment[] {
  if (!input?.length) return []

  const out: Attachment[] = []
  for (const item of input) {
    if (item.kind === 'image') {
      if (!IMAGE_TYPES.includes(item.mediaType as (typeof IMAGE_TYPES)[number])) continue
      // base64 expands by ~4/3, so the cap is applied to the decoded size.
      if ((item.data.length * 3) / 4 > MAX_IMAGE_BYTES) continue
      out.push({ ...item, kind: 'image' })
    } else {
      out.push({ ...item, kind: 'text', data: item.data.slice(0, MAX_TEXT_CHARS) })
    }
  }
  return out
}

/** Server-sent event frame. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const limit = rateLimit(`chat:${user.id}`, 30, 60_000)
  if (!limit.ok) {
    return apiError(`You are sending messages too quickly. Try again in ${limit.retryAfter}s.`, 429)
  }

  const parsed = chatSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const attachments = sanitiseAttachments(parsed.data.attachments)
  const message = parsed.data.message.trim()
  if (!message && attachments.length === 0) {
    return apiError('Enter a message or attach a file.', 422, { message: 'Enter a message.' })
  }

  const provider = getProvider()
  if (!provider.configured) {
    return apiError(
      'Nexa is not connected to an AI provider yet. Set ANTHROPIC_API_KEY in the server environment.',
      503,
    )
  }

  const model = getModel(parsed.data.model)
  if (!canUseModel(model, user.plan)) {
    return apiError(`${model.name} is available on the Pro plan.`, 403)
  }

  // Load or create the thread, always scoped to the signed-in user.
  let conversation = parsed.data.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: parsed.data.conversationId, userId: user.id },
        select: { id: true, title: true },
      })
    : null

  const isNewConversation = !conversation
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: deriveTitle(message || attachments[0]?.name || 'New chat'),
        model: model.id,
      },
      select: { id: true, title: true },
    })
  }

  const conversationId = conversation.id

  const [previous, profile] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        role: true,
        useCases: true,
        preferences: { select: { customInstructions: true } },
      },
    }),
  ])

  await prisma.message.create({
    data: {
      conversationId,
      role: 'USER',
      content: message,
      // Metadata only — the bytes are sent to the provider and then dropped.
      attachments:
        attachments.length > 0
          ? attachments.map(({ name, kind, mediaType, size }) => ({ name, kind, mediaType, size }))
          : undefined,
    },
  })

  const history: ChatMessage[] = trimHistory([
    ...previous
      // A SYSTEM row would not be a conversational turn; the system prompt is
      // rebuilt from the profile on every request instead.
      .filter((message) => message.role !== 'SYSTEM')
      .map((message) => ({
        role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
        content: message.content,
      })),
    { role: 'user', content: message, attachments },
  ])

  const systemPrompt = buildSystemPrompt({
    name: profile?.name,
    role: profile?.role,
    useCases: profile?.useCases,
    customInstructions: profile?.preferences?.customInstructions,
  })

  // Aborts the upstream call when the browser disconnects (Stop, or navigating
  // away), so we stop paying for tokens nobody will read.
  const controller = new AbortController()
  request.signal.addEventListener('abort', () => controller.abort())

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(queue) {
      let answer = ''
      let failure: string | null = null
      let usage: { inputTokens: number; outputTokens: number } | undefined
      let usedModel: string | undefined

      queue.enqueue(
        encoder.encode(
          frame('start', {
            conversationId,
            title: conversation.title,
            isNewConversation,
          }),
        ),
      )

      try {
        for await (const event of provider.stream({
          modelId: model.id,
          messages: history,
          systemPrompt,
          signal: controller.signal,
        })) {
          if (event.type === 'text') {
            answer += event.text
            queue.enqueue(encoder.encode(frame('delta', { text: event.text })))
          } else if (event.type === 'error') {
            failure = event.message
            queue.enqueue(encoder.encode(frame('error', { message: event.message })))
          } else if (event.type === 'done') {
            usage = event.usage
            usedModel = event.model
          }
        }
      } catch (error) {
        failure = 'The reply was interrupted.'
        console.error('[chat]', error)
        queue.enqueue(encoder.encode(frame('error', { message: failure })))
      }

      // Persist whatever was produced — including a partial answer — so the
      // thread reads the same after a reload as it did live.
      if (answer.trim() || failure) {
        await prisma.message
          .create({
            data: {
              conversationId,
              role: 'ASSISTANT',
              content: answer,
              model: usedModel ?? model.id,
              error: failure,
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
            },
          })
          .catch((error) => console.error('[chat] failed to persist reply', error))
      }

      await prisma.conversation
        .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
        .catch(() => {})

      queue.enqueue(encoder.encode(frame('done', { conversationId, usage })))
      queue.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx and some proxies buffer responses by default, which would hold
      // the whole reply back until it finished.
      'X-Accel-Buffering': 'no',
    },
  })
}
