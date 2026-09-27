import { PLAN_LIST, getPlan, planAllows, type PlanId } from '@/lib/billing/plans'
import { apiError } from '@/lib/utils/api'

/** Refuses adding to the calendar when the plan does not include it. */
export function calendarLockedError(plan: PlanId) {
  if (planAllows(plan, 'contentCalendar')) return null
  const needed = PLAN_LIST.find((candidate) => planAllows(candidate.id, 'contentCalendar'))
  return apiError(
    `The marketing calendar is included from ${needed?.name ?? 'a paid plan'}. You are on ${getPlan(plan).name}.`,
    403,
  )
}
