import 'server-only'

import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@/lib/generated/prisma/client'
import { defaultCampaignName, type CampaignBrief } from './options'

export type ResolvedBrief =
  | { ok: true; data: Prisma.CampaignUncheckedCreateInput }
  | { ok: false; status: number; message: string; field?: string }

/**
 * Turns a validated brief into campaign columns, checking every id it names
 * against the workspace. A brand or product id from another tenant is treated
 * as not existing.
 *
 * A new product typed into the wizard is saved as a real Product, under the
 * campaign's brand, so it can be picked next time.
 */
export async function resolveBrief(
  brief: CampaignBrief,
  workspaceId: string,
): Promise<ResolvedBrief> {
  let brandId: string | null = null
  if (brief.brandId) {
    const brand = await prisma.brand.findFirst({
      where: { id: brief.brandId, workspaceId },
      select: { id: true },
    })
    if (!brand) return { ok: false, status: 404, message: 'That brand does not exist.', field: 'brandId' }
    brandId = brand.id
  } else {
    const fallback = await prisma.brand.findFirst({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    brandId = fallback?.id ?? null
  }

  let productId: string
  let productName: string
  if (brief.productId) {
    const product = await prisma.product.findFirst({
      where: { id: brief.productId, workspaceId },
      select: { id: true, name: true },
    })
    if (!product) {
      return { ok: false, status: 404, message: 'That product does not exist.', field: 'productId' }
    }
    productId = product.id
    productName = product.name
  } else {
    const created = await prisma.product.create({
      data: { ...brief.product!, workspaceId, brandId },
      select: { id: true, name: true },
    })
    productId = created.id
    productName = created.name
  }

  return {
    ok: true,
    data: {
      workspaceId,
      brandId,
      productId,
      name: brief.name ?? defaultCampaignName(productName, brief.goal),
      goal: brief.goal,
      style: brief.style,
      platforms: brief.platforms,
      audienceAgeRange: brief.audienceAgeRange ?? null,
      audienceLocation: brief.audienceLocation ?? null,
      audienceInterests: brief.audienceInterests,
      audienceCustomerType: brief.audienceCustomerType ?? null,
      audiencePainPoints: brief.audiencePainPoints ?? null,
    },
  }
}
