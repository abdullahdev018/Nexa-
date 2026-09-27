import 'server-only'

import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'
import { getPlan, type PlanId } from '@/lib/billing/plans'

/** Anything Prisma-shaped that can run the writes — the client or a transaction. */
type Db = Pick<typeof prisma, 'workspace' | 'membership' | 'subscription' | 'creditBalance' | 'creditTransaction' | 'user'>

/** Thirty days, matching the credit period used everywhere else. */
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

/** A URL-safe slug from a name, with a short random suffix for uniqueness. */
export function workspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return `${base || 'workspace'}-${randomBytes(3).toString('hex')}`
}

export function defaultWorkspaceName(name: string | null, email: string): string {
  const who = name?.trim() || email.split('@')[0]
  return `${who}'s Workspace`
}

/**
 * Creates a workspace with everything it needs to be usable: an owner
 * membership, a subscription row, and an opening credit grant.
 *
 * The subscription is written with `provider: null`, which is what marks it as
 * never having been paid for. A plan above FREE here means the plan was
 * granted, not that money changed hands — only a real payment provider may set
 * `provider`.
 */
export async function createWorkspaceForUser(
  db: Db,
  options: { userId: string; name: string; plan?: PlanId; makeDefault?: boolean },
): Promise<{ id: string; name: string; slug: string; plan: PlanId }> {
  const plan = options.plan ?? 'FREE'
  const allowance = getPlan(plan).monthlyCredits
  const now = new Date()

  const workspace = await db.workspace.create({
    data: {
      name: options.name,
      slug: workspaceSlug(options.name),
      ownerId: options.userId,
      plan,
      memberships: { create: { userId: options.userId, role: 'OWNER' } },
      subscription: { create: { plan, status: 'ACTIVE', interval: 'MONTHLY' } },
      creditBalance: {
        create: {
          balance: allowance,
          monthlyAllowance: allowance,
          periodStart: now,
          periodEnd: new Date(now.getTime() + PERIOD_MS),
        },
      },
    },
    select: { id: true, name: true, slug: true, plan: true },
  })

  await db.creditTransaction.create({
    data: {
      workspaceId: workspace.id,
      amount: allowance,
      kind: 'GRANT',
      reason: 'Opening balance',
      balanceAfter: allowance,
      userId: options.userId,
    },
  })

  if (options.makeDefault !== false) {
    await db.user.update({
      where: { id: options.userId },
      data: { lastWorkspaceId: workspace.id },
    })
  }

  return workspace
}
