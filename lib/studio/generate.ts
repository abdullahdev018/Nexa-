import 'server-only'

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import { loadBrandContext } from '@/lib/brand/queries'
import type { GenerationActor } from '@/lib/campaigns/generate'
import { campaignContext } from '@/lib/campaigns/context'
import { FORMAT_LABEL, PLATFORM_LABEL, type ContentFormat, type Platform } from '@/lib/campaigns/options'
import type { GenerateContentRequest } from './options'
import {
  buildContentPrompt,
  buildReplacementPrompt,
  parseVariations,
  variationToBody,
  type ContentContext,
} from './plan'

const CONTENT_MODEL = 'nexa-balanced'

export type ContentOutcome =
  | { ok: true; group: string; ids: string[]; charged: number }
  | { ok: false; status: number; message: string }

/**
 * Writes one to three variations of a piece and saves them as a group.
 * Charged once, for usable variations, before they are saved; a failure costs nothing.
 */
export async function generateContent(
  request: GenerateContentRequest,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<ContentOutcome> {
  const campaign = request.campaignId ? await campaignContext(request.campaignId, actor.workspaceId) : null
  if (request.campaignId && !campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }

  let idea: string | null = null
  if (request.ideaId) {
    const asset = await prisma.campaignAsset.findFirst({
      where: { id: request.ideaId, campaignId: campaign!.id, workspaceId: actor.workspaceId, kind: 'CONTENT_IDEA' },
      select: { title: true, body: true },
    })
    if (!asset) return { ok: false, status: 404, message: 'That content idea does not exist.' }
    idea = [asset.title, asset.body].filter(Boolean).join(': ')
  }

  // The brand: the one asked for, else the campaign's, else the default.
  let brandId = campaign?.brandId ?? null
  if (request.brandId) {
    const brand = await prisma.brand.findFirst({
      where: { id: request.brandId, workspaceId: actor.workspaceId },
      select: { id: true },
    })
    if (!brand) return { ok: false, status: 404, message: 'That brand does not exist.' }
    brandId = brand.id
  }
  if (!brandId) {
    const fallback = await prisma.brand.findFirst({
      where: { workspaceId: actor.workspaceId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    brandId = fallback?.id ?? null
  }

  const context: ContentContext = {
    platform: request.platform,
    format: request.format,
    topic: request.topic,
    instructions: request.instructions,
    variations: request.variations,
    brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, brandId),
    campaign: campaign?.text,
    idea,
  }
  const { system, user } = buildContentPrompt(context)
  const result = await generateText(provider, { modelId: CONTENT_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseVariations(result.text, request.format, request.variations) : null

  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'CONTENT',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? `parse_${parsed && !parsed.ok ? parsed.reason : 'failed'}` : 'generation_failed',
    })
    return {
      ok: false,
      status: result.ok ? 502 : result.status,
      message: result.ok
        ? 'Nexa could not write usable content this time. Nothing was charged — try again.'
        : result.message,
    }
  }

  const group = randomUUID()
  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'CONTENT',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { variantGroup: group, variations: parsed.value.length },
    save: () =>
      prisma.$transaction(
        parsed.value.map((variation) =>
          prisma.content.create({
            data: {
              workspaceId: actor.workspaceId,
              campaignId: campaign?.id ?? null,
              brandId,
              platform: request.platform,
              format: request.format,
              topic: request.topic,
              title: variation.title,
              body: variationToBody(request.format, variation),
              variantGroup: group,
              createdById: actor.userId,
            },
            select: { id: true },
          }),
        ),
      ),
  })
  if (!settled.ok) return settled
  return { ok: true, group, ids: settled.value.map((row) => row.id), charged: settled.charged }
}

/**
 * Rewrites one variation in place. The old text stays until a usable
 * replacement exists. A rewritten piece goes back to Draft — it has not been
 * reviewed yet — unless it is on the calendar, where it stays.
 */
export async function regenerateContent(
  contentId: string,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<ContentOutcome> {
  const content = await prisma.content.findFirst({
    where: { id: contentId, workspaceId: actor.workspaceId },
    select: {
      id: true,
      platform: true,
      format: true,
      topic: true,
      body: true,
      status: true,
      brandId: true,
      campaignId: true,
      variantGroup: true,
    },
  })
  if (!content) return { ok: false, status: 404, message: 'That content does not exist.' }
  if (content.status === 'PUBLISHED') {
    return { ok: false, status: 409, message: 'Published content cannot be rewritten.' }
  }
  if (content.format === 'AD') {
    return { ok: false, status: 422, message: 'Ads are rewritten in Ad Studio.' }
  }

  const [others, campaign, brandBlock] = await Promise.all([
    content.variantGroup
      ? prisma.content.findMany({
          where: { variantGroup: content.variantGroup, workspaceId: actor.workspaceId, id: { not: content.id } },
          select: { body: true },
        })
      : Promise.resolve([]),
    content.campaignId ? campaignContext(content.campaignId, actor.workspaceId) : Promise.resolve(null),
    loadBrandContext(actor.workspaceId, actor.plan, content.brandId),
  ])

  const format = content.format as Exclude<ContentFormat, 'AD'>
  const { system, user } = buildReplacementPrompt({
    platform: content.platform as Platform,
    format,
    topic: content.topic ?? `A ${PLATFORM_LABEL[content.platform]} ${FORMAT_LABEL[format].toLowerCase()}`,
    variations: 1,
    brandBlock,
    campaign: campaign?.text,
    current: content.body,
    others: others.map((other) => other.body),
  })

  const result = await generateText(provider, { modelId: CONTENT_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseVariations(result.text, format, 1) : null

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

  const variation = parsed.value[0]
  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'CONTENT',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { contentId: content.id },
    save: () =>
      prisma.content.update({
        where: { id: content.id },
        // A planned piece stays on the calendar; anything else needs reviewing again.
        data: {
          title: variation.title,
          body: variationToBody(format, variation),
          status: content.status === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
        },
      }),
  })
  if (!settled.ok) return settled
  return { ok: true, group: content.variantGroup ?? content.id, ids: [content.id], charged: settled.charged }
}
