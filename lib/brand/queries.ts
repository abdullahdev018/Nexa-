import 'server-only'

import { prisma } from '@/lib/db/prisma'
import type { PlanId } from '@/lib/billing/plans'
import { brandContextBlock } from './context'
import { BRAND_SELECT, PRODUCT_SELECT, brandForPlan, toBrandProfile, type BrandProfile } from './schema'

/**
 * The brand a generation uses when it does not name one: the workspace's
 * default, or failing that its oldest. Null when the workspace has none.
 */
export async function getDefaultBrand(workspaceId: string): Promise<BrandProfile | null> {
  const row = await prisma.brand.findFirst({
    where: { workspaceId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: BRAND_SELECT,
  })
  return row ? toBrandProfile(row) : null
}

/**
 * The prompt block for a workspace's brand, with the plan's rules applied, or
 * null when there is no brand to describe. `brandId` must already be known to
 * belong to the workspace; it is re-scoped here regardless.
 */
export async function loadBrandContext(
  workspaceId: string,
  plan: PlanId,
  brandId?: string | null,
): Promise<string | null> {
  const row = brandId
    ? await prisma.brand.findFirst({ where: { id: brandId, workspaceId }, select: BRAND_SELECT })
    : null
  const brand = row ? toBrandProfile(row) : await getDefaultBrand(workspaceId)
  if (!brand) return null

  const products = await prisma.product.findMany({
    where: { workspaceId, brandId: brand.id },
    orderBy: { createdAt: 'asc' },
    select: PRODUCT_SELECT,
  })

  return brandContextBlock(brandForPlan(brand, plan), products)
}
