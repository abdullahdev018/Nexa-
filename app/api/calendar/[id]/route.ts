import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { updateItemSchema } from '@/lib/calendar/plan'
import { deleteItem } from '@/lib/calendar/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

/** Moves, renames or re-notes an item. Allowed on any plan, so a downgrade keeps the calendar usable. */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const parsed = updateItemSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const item = await prisma.calendarItem.findFirst({
    where: { id, workspaceId: context.workspace.id },
    select: { id: true, contentId: true, publishedAt: true },
  })
  if (!item) return apiError('That item does not exist.', 404)
  if (item.publishedAt) return apiError('A published item is a record of what went out.', 409)

  // An item that is a content piece takes its platform and format from it.
  const data = item.contentId ? { ...parsed.data, platform: undefined, format: undefined } : parsed.data
  const updated = await prisma.calendarItem.update({
    where: { id: item.id },
    data,
    select: { id: true, scheduledFor: true, title: true, status: true },
  })
  return NextResponse.json({ item: updated })
}

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  if (!(await deleteItem(id, context.workspace.id))) return apiError('That item does not exist.', 404)
  return NextResponse.json({ ok: true })
}
