import { NextResponse } from 'next/server'
import { z } from 'zod'
import { canAdminister, getWorkspaceContext } from '@/lib/auth/workspace'
import { PLAN_IDS } from '@/lib/billing/plans'
import { devPlanSwitchEnabled } from '@/lib/billing/payments'
import { switchPlanForDevelopment } from '@/lib/billing/dev-plan'
import { apiError, readJson, validationError } from '@/lib/utils/api'

const schema = z.object({ plan: z.enum(PLAN_IDS, 'Choose a plan.') })

/** Development only. In production, or unless turned on, this route does not exist. */
export async function POST(request: Request) {
  if (!devPlanSwitchEnabled()) return apiError('Not found.', 404)

  const context = await getWorkspaceContext()
  if (!context) return apiError('Not signed in.', 401)
  if (!canAdminister(context.role)) return apiError('Only an owner or admin can change the plan.', 403)

  const parsed = schema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const result = await switchPlanForDevelopment(context.workspace.id, parsed.data.plan, context.user.id)
  return NextResponse.json(result)
}
