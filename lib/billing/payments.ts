/**
 * Where a payment provider would plug in.
 *
 * There is none. No checkout exists, so no plan can be bought through Nexa,
 * and nothing on the billing page may look like it can. This module is the one
 * place that says so; every screen reads it rather than deciding for itself.
 *
 * Adding a provider means implementing checkout and a webhook here, setting
 * `Subscription.provider` and its ids only from verified webhook events, and
 * reporting `configured: true` only when its keys are present.
 */
export interface PaymentsStatus {
  configured: boolean
  explanation: string
}

export function payments(): PaymentsStatus {
  return {
    configured: false,
    explanation: 'Online payment is not set up yet, so plans cannot be bought or changed here.',
  }
}

/**
 * The development-only plan switch: never in production, and only when
 * explicitly turned on. It exists to exercise plan gates locally, and the page
 * labels it as exactly that.
 */
export function devPlanSwitchEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.NEXA_DEV_PLAN_SWITCH === '1'
}
