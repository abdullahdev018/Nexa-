import { PLAN_LIST, getPlan, planAllows, type PlanId } from '@/lib/billing/plans'
import type { KitField } from '@/lib/brand/schema'
import { apiError } from '@/lib/utils/api'

/** Refuses kit fields the plan does not include, naming each one on the form. */
export function kitLockedError(fields: KitField[], plan: PlanId) {
  const needed = PLAN_LIST.find((candidate) => planAllows(candidate.id, 'brandKit'))
  const message =
    `Logo, colours, fonts, tone of voice and guidelines are part of the Brand Kit, ` +
    `included from ${needed?.name ?? 'a paid plan'}. You are on ${getPlan(plan).name}.`

  return apiError(
    message,
    403,
    Object.fromEntries(fields.map((field) => [field, 'Not included on your plan.'])),
  )
}
