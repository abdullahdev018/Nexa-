import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { updateContentSchema } from '@/lib/studio/options'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

/** A hand edit or a Draft/Ready switch. Free — nothing is generated. */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const parsed = updateContentSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  if (parsed.data.status) {
    const current = await prisma.content.findFirst({
      where: { id, workspaceId: context.workspace.id },
      select: { status: true },
    })
    if (current?.status === 'SCHEDULED') {
      return apiError('This piece is on the calendar. Remove it from the calendar to change its status.', 409)
    }
  }

  const { count } = await prisma.content.updateMany({
    // Published content is a record of what went out; it is not edited after.
    // A status change never applies to a planned piece; checked again here in
    // the same statement, so the calendar cannot plan it in between.
    where: {
      id,
      workspaceId: context.workspace.id,
      status: parsed.data.status ? { notIn: ['PUBLISHED', 'SCHEDULED'] } : { not: 'PUBLISHED' },
    },
    data: parsed.data,
  })
  if (count === 0) return apiError('That content does not exist or can no longer be changed.', 404)

  const content = await prisma.content.findUnique({
    where: { id },
    select: { id: true, title: true, body: true, status: true },
  })
  return NextResponse.json({ content })
}

/** Calendar slots that pointed at it are kept and simply lose the link. */
export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.content.deleteMany({ where: { id, workspaceId: context.workspace.id } })
  if (count === 0) return apiError('That content does not exist.', 404)
  return NextResponse.json({ ok: true })
}
