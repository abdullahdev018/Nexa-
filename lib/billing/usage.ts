import { CREDIT_COSTS, CREDIT_FEATURE_LABEL, creditFeatureBuilt, type CreditFeature } from './plans'

/**
 * Reading the credit ledger. Pure.
 *
 * Spends are grouped by their recorded reason — the label written at the time
 * — so a history stays readable even if a feature is renamed later.
 */

export interface LedgerRow {
  amount: number
  kind: 'GRANT' | 'SPEND' | 'REFUND' | 'ADJUSTMENT' | 'EXPIRY'
  reason: string
}

export interface UsageLine {
  reason: string
  credits: number
  times: number
}

/** Credits spent per reason, net of refunds for the same reason, largest first. */
export function usageByReason(rows: LedgerRow[]): UsageLine[] {
  const lines = new Map<string, UsageLine>()
  for (const row of rows) {
    if (row.kind !== 'SPEND' && row.kind !== 'REFUND') continue
    const line = lines.get(row.reason) ?? { reason: row.reason, credits: 0, times: 0 }
    line.credits -= row.amount // spends are negative, refunds positive
    if (row.kind === 'SPEND') line.times += 1
    lines.set(row.reason, line)
  }
  return [...lines.values()].filter((line) => line.credits > 0).sort((a, b) => b.credits - a.credits)
}

export interface PriceLine {
  feature: CreditFeature
  label: string
  cost: number
  /** How many more of these the balance covers right now. */
  affordable: number
}

/** The price list, with what the current balance still buys. Unbuilt features are left out. */
export function priceList(balance: number): PriceLine[] {
  return (Object.keys(CREDIT_COSTS) as CreditFeature[])
    .filter(creditFeatureBuilt)
    .map((feature) => ({
      feature,
      label: CREDIT_FEATURE_LABEL[feature],
      cost: CREDIT_COSTS[feature],
      affordable: Math.floor(Math.max(0, balance) / CREDIT_COSTS[feature]),
    }))
    .sort((a, b) => b.cost - a.cost)
}

/** Whole days until `end`, never negative. */
export function daysUntil(end: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))
}
