import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { videoLockedError } from '@/lib/video/api'
import { regenerateVideoPlan } from '@/lib/video/generate'
import { apiError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export const maxDuration = 180

interface Context {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context
  const { id } = await params

  const locked = videoLockedError(workspace.plan)
  if (locked) return locked

  const limit = rateLimit(`video:${user.id}`, 8, 60_000)
  if (!limit.ok) return apiError(`Too many generations at once. Try again in ${limit.retryAfter}s.`, 429)

  if (!getProvider().configured) {
    return apiError('Nexa is not connected to an AI provider yet, so nothing can be generated.', 503)
  }

  const affordable = await canAfford(workspace.id, workspace.plan, 'VIDEO_PLAN')
  if (!affordable.ok) {
    return apiError(
      `Not enough credits. A video plan costs ${affordable.required} and the workspace has ${affordable.balance} left.`,
      402,
    )
  }

  const outcome = await regenerateVideoPlan(id, { workspaceId: workspace.id, plan: workspace.plan, userId: user.id })
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome)
}
