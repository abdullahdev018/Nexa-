import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canUseModel, getModel } from '@/lib/ai/models'
import { buildSystemPrompt, deriveTitle, trimHistory } from '@/lib/ai/prompt'
import { IMAGE_TYPES, type Attachment, type ChatMessage } from '@/lib/ai/types'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'
import { chargeCredits, recordAIUsage, refundCredits } from '@/lib/billing/credits'
import { CREDIT_FEATURE_LABEL } from '@/lib/billing/plans'
import { loadBrandContext } from '@/lib/brand/queries'

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
  // About 5 MB of base64, or 200k characters of text: bounded before it is
  // held in memory, not only when it is sanitised afterwards.
  data: z.string().min(1).max(7_000_000),
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
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context

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
    // Names the variable, never a value — this string reaches the browser.
    return apiError(
      'Nexa is not connected to an AI provider yet. Set OPENROUTER_API_KEY in the server environment.',
      503,
    )
  }

  const model = getModel(parsed.data.model)
  if (!canUseModel(model, workspace.plan)) {
    return apiError(`${model.name} is available on the Pro plan.`, 403)
  }

  // The credit is reserved up front, not merely checked: a reply streams to
  // the browser as it is written, so it cannot be held back until paid for,
  // and a read-only check would let simultaneous requests all through for the
  // price of one. If no reply arrives, the credit is refunded further down —
  // a failed reply still costs nothing.
  const reserved = await chargeCredits({
    workspaceId: workspace.id,
    plan: workspace.plan,
    feature: 'CHAT',
    userId: user.id,
    metadata: { model: model.id },
  })
  if (!reserved.ok) {
    return apiError(
      `Not enough credits. This costs ${reserved.required} and the workspace has ` +
        `${reserved.balance} left. Credits renew at the start of the next period.`,
      402,
    )
  }

  // Load or create the thread, always scoped to the signed-in user.
  let conversation = parsed.data.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: parsed.data.conversationId, userId: user.id, workspaceId: workspace.id },
        select: { id: true, title: true },
      })
    : null

  const isNewConversation = !conversation
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        title: deriveTitle(message || attachments[0]?.name || 'New chat'),
        model: model.id,
      },
      select: { id: true, title: true },
    })
  }

  const conversationId = conversation.id

  const [previous, profile, brand] = await Promise.all([
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
    loadBrandContext(workspace.id, workspace.plan),
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
    brand,
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

      // Credits are kept only for a reply that actually arrived. A failed or
      // empty generation is recorded as usage and its reserved credit goes
      // back — charging for work that did not happen is not something this
      // product does.
      const produced = answer.trim().length > 0
      let charged = reserved.charged
      let creditsLeft: number | undefined = reserved.balance

      if (!produced || failure) {
        creditsLeft = await refundCredits({
          workspaceId: workspace.id,
          amount: reserved.charged,
          reason: CREDIT_FEATURE_LABEL.CHAT,
          userId: user.id,
        }).catch((error) => {
          console.error('[chat] refund failed', error)
          return undefined
        })
        charged = 0
      }

      await recordAIUsage({
        workspaceId: workspace.id,
        userId: user.id,
        feature: 'CHAT',
        provider: provider.name,
        model: usedModel ?? model.id,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        creditsCharged: charged,
        success: produced && !failure,
        // The class of failure only — never an upstream body.
        errorKind: failure ? 'generation_failed' : null,
      })

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

      queue.enqueue(
        encoder.encode(frame('done', { conversationId, usage, credits: creditsLeft })),
      )
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
