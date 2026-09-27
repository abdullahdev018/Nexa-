import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getPlan, type PlanId } from './plans'

/**
 * Moves a workspace to another plan WITHOUT payment, for local development.
 * Callers must check `devPlanSwitchEnabled()` first.
 *
 * The subscription's `provider` is left null — which is what marks a plan as
 * never paid for — and the ledger records the change as an adjustment that
 * says plainly it was not a purchase.
 */
export async function switchPlanForDevelopment(workspaceId: string, plan: PlanId, userId: string) {
  const target = getPlan(plan)

  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.findUnique({ where: { workspaceId }, select: { balance: true } })
    const before = balance?.balance ?? 0

    await tx.workspace.update({ where: { id: workspaceId }, data: { plan } })
    await tx.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan },
      update: { plan },
    })
    // The new plan's allowance, from now. What was already spent this period
    // is not refunded or charged; the balance simply becomes the new allowance.
    await tx.creditBalance.update({
      where: { workspaceId },
      data: { balance: target.monthlyCredits, monthlyAllowance: target.monthlyCredits },
    })
    await tx.creditTransaction.create({
      data: {
        workspaceId,
        amount: target.monthlyCredits - before,
        kind: 'ADJUSTMENT',
        reason: `Switched to ${target.name} (development only — not a purchase)`,
        balanceAfter: target.monthlyCredits,
        userId,
      },
    })
    return { plan, balance: target.monthlyCredits }
  })
}
