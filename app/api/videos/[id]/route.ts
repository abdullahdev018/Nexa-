import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { normaliseTimings, videoPlanSchema } from '@/lib/video/plan'
import { apiError, readJson, validationError } from '@/lib/utils/api'

interface Context {
  params: Promise<{ id: string }>
}

/**
 * Saves a hand-edited plan. Free, and allowed on any plan — a workspace that
 * downgrades keeps its plans. The timings are re-balanced to the video's
 * length, so adding or removing a scene cannot leave gaps or overlaps.
 */
export async function PATCH(request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const body = (await readJson<{ plan?: unknown }>(request)) ?? {}
  const parsed = videoPlanSchema.safeParse(body.plan)
  if (!parsed.success) return validationError(parsed.error)

  const video = await prisma.video.findFirst({
    where: { id, workspaceId: context.workspace.id },
    select: { id: true, durationSeconds: true },
  })
  if (!video) return apiError('That video does not exist.', 404)

  const plan = { ...parsed.data, scenes: normaliseTimings(parsed.data.scenes, video.durationSeconds ?? 30, { keepOrder: true }) }
  await prisma.video.update({
    where: { id: video.id },
    data: { title: plan.title, plan: plan as never },
  })
  return NextResponse.json({ plan })
}

export async function DELETE(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { id } = await params

  const { count } = await prisma.video.deleteMany({ where: { id, workspaceId: context.workspace.id } })
  if (count === 0) return apiError('That video does not exist.', 404)
  return NextResponse.json({ ok: true })
}
