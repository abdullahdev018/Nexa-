import 'server-only'

import { prisma } from '@/lib/db/prisma'
import {
  CREDIT_FEATURE_LABEL,
  creditCost,
  getPlan,
  type CreditFeature,
  type PlanId,
} from './plans'

/**
 * Credits are metered per workspace, and charged only AFTER a generation has
 * actually produced something. A failed call is recorded in AIUsage and costs
 * nothing — billing for work that did not happen is exactly the kind of lie
 * this product must not tell.
 */

/** Thirty days. Matches the period written at provisioning time. */
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

export interface CreditSnapshot {
  balance: number
  monthlyAllowance: number
  periodStart: Date
  periodEnd: Date
}

/**
 * Reads the balance, rolling the period forward first if it has elapsed.
 *
 * The roll-over is a conditional update: only the caller whose WHERE still
 * matches an expired period performs it, so two concurrent requests cannot
 * both grant the allowance.
 */
export async function getCreditSnapshot(
  workspaceId: string,
  plan: PlanId,
): Promise<CreditSnapshot> {
  const existing = await prisma.creditBalance.findUnique({
    where: { workspaceId },
    select: { balance: true, monthlyAllowance: true, periodStart: true, periodEnd: true },
  })

  const now = new Date()

  if (!existing) {
    // A workspace should always have a balance row; create one rather than
    // failing a page render over it.
    const allowance = getPlan(plan).monthlyCredits
    const created = await prisma.creditBalance.create({
      data: {
        workspaceId,
        balance: allowance,
        monthlyAllowance: allowance,
        periodStart: now,
        periodEnd: new Date(now.getTime() + PERIOD_MS),
      },
      select: { balance: true, monthlyAllowance: true, periodStart: true, periodEnd: true },
    })
    return created
  }

  if (existing.periodEnd > now) return existing

  const allowance = getPlan(plan).monthlyCredits
  const periodEnd = new Date(now.getTime() + PERIOD_MS)

  const rolled = await prisma.creditBalance.updateMany({
    where: { workspaceId, periodEnd: { lte: now } },
    data: {
      balance: allowance,
      monthlyAllowance: allowance,
      periodStart: now,
      periodEnd,
    },
  })

  if (rolled.count > 0) {
    await prisma.creditTransaction.create({
      data: {
        workspaceId,
        amount: allowance,
        kind: 'GRANT',
        reason: 'Monthly credits',
        balanceAfter: allowance,
      },
    })
    return { balance: allowance, monthlyAllowance: allowance, periodStart: now, periodEnd }
  }

  // Another request rolled it first; read what they wrote.
  const fresh = await prisma.creditBalance.findUnique({
    where: { workspaceId },
    select: { balance: true, monthlyAllowance: true, periodStart: true, periodEnd: true },
  })
  return fresh ?? existing
}

export type ChargeResult =
  | { ok: true; charged: number; balance: number }
  | { ok: false; reason: 'INSUFFICIENT'; required: number; balance: number }

/**
 * Deducts the cost of a feature. The conditional `updateMany` is what makes
 * this safe under concurrency: the row is only decremented when it still holds
 * enough, so two simultaneous generations cannot drive a balance negative.
 */
export async function chargeCredits(options: {
  workspaceId: string
  plan: PlanId
  feature: CreditFeature
  userId?: string | null
  /** Overrides the configured price, for bulk operations. */
  amount?: number
  metadata?: Record<string, unknown>
}): Promise<ChargeResult> {
  const amount = options.amount ?? creditCost(options.feature)
  if (amount <= 0) {
    const snapshot = await getCreditSnapshot(options.workspaceId, options.plan)
    return { ok: true, charged: 0, balance: snapshot.balance }
  }

  // Roll the period first, so a generation at the start of a new month is paid
  // for out of the new allowance rather than being refused.
  await getCreditSnapshot(options.workspaceId, options.plan)

  const applied = await prisma.creditBalance.updateMany({
    where: { workspaceId: options.workspaceId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })

  if (applied.count === 0) {
    const snapshot = await getCreditSnapshot(options.workspaceId, options.plan)
    return { ok: false, reason: 'INSUFFICIENT', required: amount, balance: snapshot.balance }
  }

  const after = await prisma.creditBalance.findUnique({
    where: { workspaceId: options.workspaceId },
    select: { balance: true },
  })
  const balance = after?.balance ?? 0

  await prisma.creditTransaction.create({
    data: {
      workspaceId: options.workspaceId,
      amount: -amount,
      kind: 'SPEND',
      reason: CREDIT_FEATURE_LABEL[options.feature],
      balanceAfter: balance,
      userId: options.userId ?? null,
      metadata: options.metadata as never,
    },
  })

  return { ok: true, charged: amount, balance }
}

/** Returns credits after a charge that turned out not to have produced anything. */
export async function refundCredits(options: {
  workspaceId: string
  amount: number
  reason: string
  userId?: string | null
}): Promise<number> {
  if (options.amount <= 0) return 0

  const updated = await prisma.creditBalance.update({
    where: { workspaceId: options.workspaceId },
    data: { balance: { increment: options.amount } },
    select: { balance: true },
  })

  await prisma.creditTransaction.create({
    data: {
      workspaceId: options.workspaceId,
      amount: options.amount,
      kind: 'REFUND',
      reason: options.reason,
      balanceAfter: updated.balance,
      userId: options.userId ?? null,
    },
  })

  return updated.balance
}

/** True when the workspace could pay for `feature` right now. */
export async function canAfford(
  workspaceId: string,
  plan: PlanId,
  feature: CreditFeature,
): Promise<{ ok: boolean; required: number; balance: number }> {
  const required = creditCost(feature)
  const snapshot = await getCreditSnapshot(workspaceId, plan)
  return { ok: snapshot.balance >= required, required, balance: snapshot.balance }
}

/**
 * Records a model call. Kept apart from the credit ledger because usage is a
 * technical fact (tokens, model, provider) and credit is a commercial one — a
 * failed call belongs here and nowhere else.
 */
export async function recordAIUsage(options: {
  workspaceId: string
  userId?: string | null
  feature: CreditFeature
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
  creditsCharged?: number
  success: boolean
  /** The CLASS of failure only — never an upstream body. */
  errorKind?: string | null
}): Promise<void> {
  await prisma.aIUsage
    .create({
      data: {
        workspaceId: options.workspaceId,
        userId: options.userId ?? null,
        feature: options.feature,
        provider: options.provider,
        model: options.model,
        inputTokens: options.inputTokens ?? 0,
        outputTokens: options.outputTokens ?? 0,
        creditsCharged: options.creditsCharged ?? 0,
        success: options.success,
        errorKind: options.errorKind ?? null,
      },
    })
    // Usage logging must never break a reply that already worked.
    .catch((error) => console.error('[credits] failed to record usage', error))
}
