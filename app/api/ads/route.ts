import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { adRequestSchema } from '@/lib/ads/plan'
import { generateAds } from '@/lib/ads/generate'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export const maxDuration = 180

/** Writes a set of ads. Launches nothing and spends nothing. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context

  const limit = rateLimit(`ads:${user.id}`, 10, 60_000)
  if (!limit.ok) return apiError(`Too many generations at once. Try again in ${limit.retryAfter}s.`, 429)

  const parsed = adRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

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

  const outcome = await generateAds(parsed.data, { workspaceId: workspace.id, plan: workspace.plan, userId: user.id })
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome, { status: 201 })
}
