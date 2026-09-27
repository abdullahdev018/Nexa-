import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getCreditSnapshot } from '@/lib/billing/credits'
import type { PlanId } from '@/lib/billing/plans'

/** Everything the brief wizard offers to pick from, scoped to one workspace. */
export async function loadWizardData(workspaceId: string, plan: PlanId) {
  const [brands, products, credits] = await Promise.all([
    prisma.brand.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    prisma.product.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, brandId: true, category: true },
    }),
    getCreditSnapshot(workspaceId, plan),
  ])
  return { brands, products, balance: credits.balance }
}
