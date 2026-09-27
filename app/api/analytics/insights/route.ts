import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { RANGES, rangeWindow } from '@/lib/analytics/metrics'
import { analyticsLockedError, runInsights } from '@/lib/analytics/service'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export const maxDuration = 120

const insightsSchema = z.object({
  range: z.enum(Object.keys(RANGES) as [keyof typeof RANGES]).default('30d'),
  campaignId: z.string().min(1).max(40).nullable().optional(),
})

/** Nexa Insights on the workspace's own numbers. There is no demo variant. */
export async function POST(request: Request) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context

  const locked = analyticsLockedError(workspace.plan)
  if (locked) return locked

  const limit = rateLimit(`insights:${user.id}`, 6, 60_000)
  if (!limit.ok) return apiError(`Try again in ${limit.retryAfter}s.`, 429)

  const parsed = insightsSchema.safeParse((await readJson(request)) ?? {})
  if (!parsed.success) return validationError(parsed.error)

  if (!getProvider().configured) {
    return apiError('Nexa is not connected to an AI provider yet, so nothing can be generated.', 503)
  }
  const affordable = await canAfford(workspace.id, workspace.plan, 'INSIGHTS')
  if (!affordable.ok) {
    return apiError(`Not enough credits. Insights cost ${affordable.required} and the workspace has ${affordable.balance} left.`, 402)
  }

  const { from, to } = rangeWindow(parsed.data.range)
  const outcome = await runInsights(
    { from, to, campaignId: parsed.data.campaignId ?? null },
    { workspaceId: workspace.id, plan: workspace.plan, userId: user.id },
  )
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome)
}
