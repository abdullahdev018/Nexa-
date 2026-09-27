import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { CAMPAIGN_WITH_BRIEF, toBrief } from './generate'
import { describeBrief } from './plan'

/** The campaign's brief and strategy, as the prompt reads it. */
export async function campaignContext(campaignId: string, workspaceId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      ...CAMPAIGN_WITH_BRIEF,
      name: true,
      assets: {
        where: { kind: { in: ['STRATEGY', 'MARKETING_ANGLE', 'HOOK'] } },
        select: { kind: true, body: true },
      },
    },
  })
  if (!campaign) return null

  const strategy = campaign.assets
    .map((asset) => `${asset.kind === 'STRATEGY' ? 'Strategy' : asset.kind === 'HOOK' ? 'Main hook' : 'Main angle'}: ${asset.body.slice(0, 1500)}`)
    .join('\n')
  return {
    id: campaign.id,
    brandId: campaign.brandId,
    text: [`Campaign: ${campaign.name}`, describeBrief(toBrief(campaign)), strategy].filter(Boolean).join('\n'),
  }
}

/** A product as the prompt reads it, scoped to the workspace. */
export async function productContext(productId: string, workspaceId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true, name: true, description: true, category: true, price: true, brandId: true },
  })
  if (!product) return null
  const text = [
    product.name,
    product.category && `Category: ${product.category}`,
    product.price && `Price: ${product.price}`,
    product.description,
  ]
    .filter(Boolean)
    .join('\n')
  return { id: product.id, brandId: product.brandId, text }
}

/** The workspace's default brand, or its oldest. */
export async function defaultBrandId(workspaceId: string): Promise<string | null> {
  const brand = await prisma.brand.findFirst({
    where: { workspaceId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  return brand?.id ?? null
}
