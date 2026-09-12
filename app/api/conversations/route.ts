import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { getModel } from '@/lib/ai/models'
import { apiError, readJson, validationError } from '@/lib/utils/api'

/** Lists the signed-in user's threads for the sidebar and history page. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() ?? ''
  const includeArchived = searchParams.get('archived') === 'true'

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: user.id,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' as const } },
              // Searching message bodies is what makes history genuinely
              // useful; without it only threads the user remembered to rename
              // are findable.
              { messages: { some: { content: { contains: query, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      model: true,
      pinned: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ conversations })
}

const createSchema = z.object({
  title: z.string().max(120).optional(),
  model: z.string().max(40).optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const parsed = createSchema.safeParse((await readJson(request)) ?? {})
  if (!parsed.success) return validationError(parsed.error)

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: parsed.data.title?.trim() || 'New chat',
      model: getModel(parsed.data.model).id,
    },
    select: { id: true, title: true, model: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ conversation }, { status: 201 })
}
