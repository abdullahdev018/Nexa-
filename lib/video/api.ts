import { PLAN_LIST, getPlan, planAllows, type PlanId } from '@/lib/billing/plans'
import { apiError } from '@/lib/utils/api'

/** Refuses a video generation the plan does not include, naming the plan that does. */
export function videoLockedError(plan: PlanId) {
  if (planAllows(plan, 'videoGeneration')) return null
  const needed = PLAN_LIST.find((candidate) => planAllows(candidate.id, 'videoGeneration'))
  return apiError(
    `AI video planning is included from ${needed?.name ?? 'a paid plan'}. You are on ${getPlan(plan).name}.`,
    403,
  )
}
