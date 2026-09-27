import 'server-only'

import { prisma } from '@/lib/db/prisma'
import type { Prisma } from '@/lib/generated/prisma/client'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import type { PlanId } from '@/lib/billing/plans'
import { loadBrandContext } from '@/lib/brand/queries'
import { isGenerationStale, type CampaignStatus } from './options'
import {
  buildCampaignPrompt,
  buildItemPrompt,
  isItemKind,
  itemToAsset,
  parseCampaignPlan,
  parseItem,
  planToAssets,
  type AssetMeta,
  type BriefForPrompt,
} from './plan'

/** Whole campaigns use the balanced tier: this is the product's main output. */
const CAMPAIGN_MODEL = 'nexa-balanced'
/** One replacement piece is short; the fast tier is plenty. */
const ITEM_MODEL = 'nexa-swift'

export interface GenerationActor {
  workspaceId: string
  plan: PlanId
  userId: string
}

export type GenerationOutcome =
  | { ok: true; charged: number }
  | { ok: false; status: number; message: string }

/** The campaign columns a prompt needs. Shared with the Content Studio. */
export const CAMPAIGN_WITH_BRIEF = {
  id: true,
  status: true,
  updatedAt: true,
  generatedAt: true,
  brandId: true,
  goal: true,
  style: true,
  platforms: true,
  audienceAgeRange: true,
  audienceLocation: true,
  audienceInterests: true,
  audienceCustomerType: true,
  audiencePainPoints: true,
  product: { select: { name: true, description: true, category: true, price: true } },
} as const

export type CampaignWithBrief = Prisma.CampaignGetPayload<{ select: typeof CAMPAIGN_WITH_BRIEF }>

export function toBrief(campaign: CampaignWithBrief): BriefForPrompt {
  return {
    // A campaign whose product was deleted still generates, from its name.
    productName: campaign.product?.name ?? 'the product',
    productDescription: campaign.product?.description,
    productCategory: campaign.product?.category,
    productPrice: campaign.product?.price,
    goal: campaign.goal,
    style: campaign.style,
    platforms: campaign.platforms,
    audienceAgeRange: campaign.audienceAgeRange,
    audienceLocation: campaign.audienceLocation,
    audienceInterests: campaign.audienceInterests,
    audienceCustomerType: campaign.audienceCustomerType,
    audiencePainPoints: campaign.audiencePainPoints,
  }
}

/**
 * Generates (or regenerates) a whole campaign.
 *
 * The campaign is claimed with a compare-and-set on its status and timestamp,
 * so a double click or a second tab cannot run — and bill — the same
 * generation twice. Credits are charged only for a valid plan, and before it is
 * saved (see `payThenSave`); a failure leaves the previous plan, if any,
 * untouched and costs nothing.
 */
export async function generateCampaign(
  campaignId: string,
  actor: GenerationActor,
  /** Injectable so the save-and-charge path can be exercised without a live model. */
  provider: AIProvider = getProvider(),
): Promise<GenerationOutcome> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
    select: CAMPAIGN_WITH_BRIEF,
  })
  if (!campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }

  if (campaign.status === 'GENERATING' && !isGenerationStale(campaign.status, campaign.updatedAt)) {
    return { ok: false, status: 409, message: 'This campaign is already being generated.' }
  }

  const claimed = await prisma.campaign.updateMany({
    where: { id: campaign.id, status: campaign.status, updatedAt: campaign.updatedAt },
    data: { status: 'GENERATING', lastError: null },
  })
  if (claimed.count === 0) {
    return { ok: false, status: 409, message: 'This campaign is already being generated.' }
  }

  // Where the campaign goes back to if this attempt fails.
  const previous: CampaignStatus =
    campaign.status === 'GENERATING' ? (campaign.generatedAt ? 'READY' : 'DRAFT') : campaign.status

  const brandBlock = await loadBrandContext(actor.workspaceId, actor.plan, campaign.brandId)
  const { system, user } = buildCampaignPrompt(toBrief(campaign), brandBlock)

  // No abort signal: a campaign keeps generating if the user closes the tab,
  // and is waiting for them when they come back.
  const result = await generateText(provider, { modelId: CAMPAIGN_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseCampaignPlan(result.text) : null

  if (!result.ok || !parsed?.ok) {
    const message = !result.ok
      ? result.message
      : 'Nexa could not produce a complete campaign this time. Nothing was charged — try again.'

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: previous, lastError: message },
    })
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'CAMPAIGN',
      provider: provider.name,
      model: result.model,
      inputTokens: result.ok ? result.usage?.inputTokens : undefined,
      outputTokens: result.ok ? result.usage?.outputTokens : undefined,
      success: false,
      errorKind: result.ok ? `parse_${parsed && !parsed.ok ? parsed.reason : 'failed'}` : 'generation_failed',
    })
    return { ok: false, status: result.ok ? 502 : result.status, message }
  }

  const plan = parsed.value
  const assets = planToAssets(plan)

  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'CAMPAIGN',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { campaignId: campaign.id },
    save: () =>
      prisma.$transaction([
        prisma.campaignAsset.deleteMany({ where: { campaignId: campaign.id } }),
        prisma.campaignAsset.createMany({
          data: assets.map((asset) => ({
            ...asset,
            meta: (asset.meta ?? undefined) as never,
            campaignId: campaign.id,
            workspaceId: actor.workspaceId,
          })),
        }),
        prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            strategy: plan as never,
            generatedAt: new Date(),
            // A campaign the user had marked live stays live after a regenerate.
            status: previous === 'ACTIVE' ? 'ACTIVE' : 'READY',
            lastError: null,
          },
        }),
      ]),
  })

  if (!settled.ok) {
    // Lost the race for the last credits: release the claim, keep the old plan.
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: previous, lastError: settled.message },
    })
    return settled
  }
  return { ok: true, charged: settled.charged }
}

/**
 * Replaces one piece of a campaign with a fresh one. The asset is only
 * overwritten once a valid replacement exists; until then the old one stays.
 */
export async function regenerateAsset(
  assetId: string,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<GenerationOutcome> {
  const asset = await prisma.campaignAsset.findFirst({
    where: { id: assetId, workspaceId: actor.workspaceId },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      meta: true,
      campaign: { select: CAMPAIGN_WITH_BRIEF },
    },
  })
  if (!asset) return { ok: false, status: 404, message: 'That piece does not exist.' }
  if (!isItemKind(asset.kind)) {
    return {
      ok: false,
      status: 422,
      message: 'The strategy sections are regenerated with the whole campaign.',
    }
  }
  if (asset.campaign.status === 'GENERATING') {
    return { ok: false, status: 409, message: 'Wait for the campaign to finish generating.' }
  }

  const kind = asset.kind
  const [siblings, strategy, brandBlock] = await Promise.all([
    prisma.campaignAsset.findMany({
      where: { campaignId: asset.campaign.id, kind, id: { not: asset.id } },
      orderBy: { position: 'asc' },
      select: { title: true, body: true },
    }),
    prisma.campaignAsset.findFirst({
      where: { campaignId: asset.campaign.id, kind: 'STRATEGY' },
      select: { body: true },
    }),
    loadBrandContext(actor.workspaceId, actor.plan, asset.campaign.brandId),
  ])

  const describe = (piece: { title: string | null; body: string }) =>
    (piece.title ? `${piece.title}: ${piece.body}` : piece.body).slice(0, 300)
  const day = (asset.meta as AssetMeta | null)?.day

  const { system, user } = buildItemPrompt({
    kind,
    brief: toBrief(asset.campaign),
    brandBlock,
    strategy: strategy?.body ?? null,
    current: describe(asset),
    siblings: siblings.map(describe),
    day,
  })

  const result = await generateText(provider, { modelId: ITEM_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseItem(kind, result.text) : null

  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'CONTENT',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? 'parse_failed' : 'generation_failed',
    })
    return {
      ok: false,
      status: result.ok ? 502 : result.status,
      message: result.ok
        ? 'Nexa could not write a replacement this time. Nothing was charged — try again.'
        : result.message,
    }
  }

  const next = itemToAsset(kind, parsed.value)
  // A calendar slot keeps its day, whatever the model chose.
  const meta = day && next.meta ? { ...next.meta, day } : next.meta

  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'CONTENT',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { campaignId: asset.campaign.id, assetId: asset.id },
    save: () =>
      prisma.campaignAsset.update({
        where: { id: asset.id },
        data: { title: next.title, body: next.body, meta: (meta ?? undefined) as never },
      }),
  })
  return settled.ok ? { ok: true, charged: settled.charged } : settled
}
