import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

/** Full thread with messages, for opening a conversation. */
export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const { id } = await params
  const conversation = await prisma.conversation.findFirst({
    // Scoped by userId as well as id, so guessing an id reveals nothing.
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      model: true,
      pinned: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          model: true,
          error: true,
          createdAt: true,
          // Metadata only — enough to redraw the file chips in a reopened
          // thread, though the bytes themselves were never stored.
          attachments: true,
        },
      },
    },
  })

  if (!conversation) return apiError('Conversation not found.', 404)
  return NextResponse.json({ conversation })
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  model: z.string().max(40).optional(),
})

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const { id } = await params
  const parsed = updateSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const owned = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })
  if (!owned) return apiError('Conversation not found.', 404)

  const { archived, ...rest } = parsed.data
  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
    },
    select: { id: true, title: true, pinned: true, archivedAt: true, model: true },
  })

  return NextResponse.json({ conversation })
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const { id } = await params
  const deleted = await prisma.conversation.deleteMany({ where: { id, userId: user.id } })
  if (deleted.count === 0) return apiError('Conversation not found.', 404)

  return NextResponse.json({ ok: true })
}
