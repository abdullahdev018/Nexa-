import 'server-only'

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import { loadBrandContext } from '@/lib/brand/queries'
import { campaignContext, defaultBrandId, productContext } from '@/lib/campaigns/context'
import type { GenerationActor } from '@/lib/campaigns/generate'
import type { CampaignGoal } from '@/lib/campaigns/options'
import { adToText, buildAdPrompt, parseAds, type AdPlatform, type AdPromptContext, type AdRequest, type AdVariation } from './plan'

const AD_MODEL = 'nexa-balanced'

export type AdOutcome =
  | { ok: true; group: string; ids: string[]; charged: number }
  | { ok: false; status: number; message: string }

async function writeAds(context: AdPromptContext, actor: GenerationActor, provider: AIProvider) {
  const { system, user } = buildAdPrompt(context)
  const result = await generateText(provider, { modelId: AD_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseAds(result.text, context.platform, context.variations) : null

  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'AD',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? `parse_${parsed && !parsed.ok ? parsed.reason : 'failed'}` : 'generation_failed',
    })
    return {
      ok: false as const,
      status: result.ok ? 502 : result.status,
      message: result.ok
        ? 'Nexa could not write ads that fit the platform this time. Nothing was charged — try again.'
        : result.message,
    }
  }
  return { ok: true as const, ads: parsed.value, model: result.model, usage: result.usage }
}

/** Pays for a written set, then saves it — see `payThenSave`. */
function settle<T>(
  actor: GenerationActor,
  provider: AIProvider,
  written: { model: string; usage?: { inputTokens: number; outputTokens: number } },
  metadata: Record<string, unknown>,
  save: () => Promise<T>,
) {
  return payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'AD',
    provider: provider.name,
    model: written.model,
    usage: written.usage,
    metadata,
    save,
  })
}

/**
 * Writes a set of ads and saves them as one group. Every ad is saved
 * NOT_LAUNCHED — nothing is sent to an ad platform.
 */
export async function generateAds(
  request: AdRequest,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<AdOutcome> {
  const product = request.productId ? await productContext(request.productId, actor.workspaceId) : null
  if (request.productId && !product) return { ok: false, status: 404, message: 'That product does not exist.' }
  const campaign = request.campaignId ? await campaignContext(request.campaignId, actor.workspaceId) : null
  if (request.campaignId && !campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }

  const brandId = product?.brandId ?? campaign?.brandId ?? (await defaultBrandId(actor.workspaceId))
  const written = await writeAds(
    {
      platform: request.platform,
      objective: request.objective,
      variations: request.variations,
      brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, brandId),
      product: product?.text,
      campaign: campaign?.text,
      offer: request.offer,
      audience: request.audience,
      notes: request.notes,
    },
    actor,
    provider,
  )
  if (!written.ok) return written

  const group = randomUUID()
  const settled = await settle(actor, provider, written, { variantGroup: group, ads: written.ads.length }, () =>
    prisma.$transaction(
      written.ads.map((ad) =>
        prisma.ad.create({
          data: {
            ...ad,
            workspaceId: actor.workspaceId,
            campaignId: campaign?.id ?? null,
            platform: request.platform,
            variantGroup: group,
            launchState: 'NOT_LAUNCHED',
            createdById: actor.userId,
          },
          select: { id: true },
        }),
      ),
    ),
  )
  if (!settled.ok) return settled
  return { ok: true, group, ids: settled.value.map((row) => row.id), charged: settled.charged }
}

const AD_FIELDS = {
  primaryText: true,
  headlines: true,
  descriptions: true,
  cta: true,
  audienceAngle: true,
  creativeConcept: true,
} as const

/** Rewrites one ad in its set. The old copy stays until a usable one exists. */
export async function regenerateAd(
  adId: string,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<AdOutcome> {
  const ad = await prisma.ad.findFirst({
    where: { id: adId, workspaceId: actor.workspaceId },
    select: { id: true, platform: true, campaignId: true, variantGroup: true, launchState: true, ...AD_FIELDS },
  })
  if (!ad) return { ok: false, status: 404, message: 'That ad does not exist.' }
  if (ad.launchState === 'LAUNCHED') {
    return { ok: false, status: 409, message: 'A launched ad is a record of what ran; it cannot be rewritten.' }
  }

  const platform = ad.platform as AdPlatform
  const [others, campaign] = await Promise.all([
    ad.variantGroup
      ? prisma.ad.findMany({
          where: { variantGroup: ad.variantGroup, workspaceId: actor.workspaceId, id: { not: ad.id } },
          select: AD_FIELDS,
        })
      : [],
    ad.campaignId ? campaignContext(ad.campaignId, actor.workspaceId) : null,
  ])
  const goal = ad.campaignId
    ? (await prisma.campaign.findFirst({ where: { id: ad.campaignId, workspaceId: actor.workspaceId }, select: { goal: true } }))?.goal
    : null

  const written = await writeAds(
    {
      platform,
      objective: (goal ?? 'SALES') as CampaignGoal,
      variations: 1,
      brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, campaign?.brandId ?? (await defaultBrandId(actor.workspaceId))),
      campaign: campaign?.text,
      current: adToText(platform, ad as AdVariation),
      others: others.map((other) => adToText(platform, other as AdVariation)),
    },
    actor,
    provider,
  )
  if (!written.ok) return written

  const settled = await settle(actor, provider, written, { adId: ad.id }, () =>
    prisma.ad.update({ where: { id: ad.id }, data: { ...written.ads[0], status: 'DRAFT' } }),
  )
  if (!settled.ok) return settled
  return { ok: true, group: ad.variantGroup ?? ad.id, ids: [ad.id], charged: settled.charged }
}
