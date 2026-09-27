import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/auth/workspace'
import { getProvider } from '@/lib/ai'
import { canAfford } from '@/lib/billing/credits'
import { generateCampaign } from '@/lib/campaigns/generate'
import { apiError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

// A full campaign is a long generation.
export const maxDuration = 300

interface Context {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Context) {
  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  const { user, workspace } = context
  const { id } = await params

  const limit = rateLimit(`campaign:${user.id}`, 6, 60_000)
  if (!limit.ok) return apiError(`Too many generations at once. Try again in ${limit.retryAfter}s.`, 429)

  if (!getProvider().configured) {
    return apiError('Nexa is not connected to an AI provider yet, so nothing can be generated.', 503)
  }

  // Checked up front so a workspace that cannot pay is told before waiting.
  // The charge itself happens only after a plan has been saved.
  const affordable = await canAfford(workspace.id, workspace.plan, 'CAMPAIGN')
  if (!affordable.ok) {
    return apiError(
      `Not enough credits. A campaign costs ${affordable.required} and the workspace has ` +
        `${affordable.balance} left.`,
      402,
    )
  }

  const outcome = await generateCampaign(id, {
    workspaceId: workspace.id,
    plan: workspace.plan,
    userId: user.id,
  })
  if (!outcome.ok) return apiError(outcome.message, outcome.status)
  return NextResponse.json(outcome)
}
