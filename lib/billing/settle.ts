import 'server-only'

import { chargeCredits, recordAIUsage, refundCredits } from './credits'
import { CREDIT_FEATURE_LABEL, getPlan, type CreditFeature, type PlanId } from './plans'

export interface SettleOptions<T> {
  workspaceId: string
  plan: PlanId
  userId: string
  feature: CreditFeature
  provider: string
  model: string
  usage?: { inputTokens: number; outputTokens: number }
  metadata?: Record<string, unknown>
  /** Writes the generation's result. Runs only once it has been paid for. */
  save: () => Promise<T>
}

export type SettleResult<T> =
  | { ok: true; value: T; charged: number }
  | { ok: false; status: number; message: string }

/**
 * Pays for a generation that succeeded, then keeps it.
 *
 * The order is the point. `canAfford` before generating is only a read, so
 * several requests at once can all pass it; charging *after* saving would then
 * hand out results that were never paid for. Here the conditional charge comes
 * first: whoever loses the race gets nothing saved and a clear message, and a
 * failed generation — which never reaches this function — still costs nothing.
 * If the save itself fails after the charge, the credits are refunded.
 */
export async function payThenSave<T>(options: SettleOptions<T>): Promise<SettleResult<T>> {
  const charge = await chargeCredits({
    workspaceId: options.workspaceId,
    plan: options.plan,
    feature: options.feature,
    userId: options.userId,
    metadata: { ...options.metadata, model: options.model },
  })

  const usage = {
    workspaceId: options.workspaceId,
    userId: options.userId,
    feature: options.feature,
    provider: options.provider,
    model: options.model,
    inputTokens: options.usage?.inputTokens,
    outputTokens: options.usage?.outputTokens,
  }

  if (!charge.ok) {
    await recordAIUsage({ ...usage, success: false, errorKind: 'insufficient_credits' })
    return {
      ok: false,
      status: 402,
      message:
        `Not enough credits: this needs ${charge.required} and the workspace has ${charge.balance} left ` +
        `on the ${getPlan(options.plan).name} plan. Nothing was charged and nothing was saved.`,
    }
  }

  let value: T
  try {
    value = await options.save()
  } catch (error) {
    await refundCredits({
      workspaceId: options.workspaceId,
      amount: charge.charged,
      // The same label as the charge, so usage by feature nets the two out.
      reason: CREDIT_FEATURE_LABEL[options.feature],
      userId: options.userId,
    })
    await recordAIUsage({ ...usage, success: false, errorKind: 'save_failed' })
    throw error
  }

  await recordAIUsage({ ...usage, creditsCharged: charge.charged, success: true })
  return { ok: true, value, charged: charge.charged }
}
