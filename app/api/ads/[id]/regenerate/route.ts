import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { regenerateAd } from '@/lib/ads/generate'
import { apiError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export const maxDuration = 120

interface Context {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context
  const { id } = await params

  const limit = rateLimit(`ads-regen:${user.id}`, 20, 60_000)
  if (!limit.ok) return apiError(`Slow down a little. Try again in ${limit.retryAfter}s.`, 429)

  if (!getProvider().configured) {
    return apiError('Nexa is not connected to an AI provider yet, so nothing can be generated.', 503)
  }

  const affordable = await canAfford(workspace.id, workspace.plan, 'AD')
  if (!affordable.ok) {
    return apiError(
      `Not enough credits. This costs ${affordable.required} and the workspace has ${affordable.balance} left.`,
      402,
    )
  }

  const outcome = await regenerateAd(id, { workspaceId: workspace.id, plan: workspace.plan, userId: user.id })
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome)
}
