import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import { loadBrandContext } from '@/lib/brand/queries'
import { campaignContext, defaultBrandId, productContext } from '@/lib/campaigns/context'
import type { GenerationActor } from '@/lib/campaigns/generate'
import type { Platform } from '@/lib/campaigns/options'
import {
  buildVideoPrompt,
  parseVideoPlan,
  planToText,
  videoPlanSchema,
  type VideoPromptContext,
  type VideoRequest,
  type VideoType,
} from './plan'

const VIDEO_MODEL = 'nexa-balanced'

export type VideoOutcome =
  | { ok: true; id: string; charged: number }
  | { ok: false; status: number; message: string }

/** Runs the model and returns a parsed plan, logging a failure as usage. */
async function writePlan(
  context: VideoPromptContext,
  actor: GenerationActor,
  provider: AIProvider,
) {
  const { system, user } = buildVideoPrompt(context)
  const result = await generateText(provider, { modelId: VIDEO_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseVideoPlan(result.text, context.durationSeconds) : null

  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'VIDEO_PLAN',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? `parse_${parsed && !parsed.ok ? parsed.reason : 'failed'}` : 'generation_failed',
    })
    return {
      ok: false as const,
      status: result.ok ? 502 : result.status,
      message: result.ok
        ? 'Nexa could not write a complete video plan this time. Nothing was charged — try again.'
        : result.message,
    }
  }
  return { ok: true as const, plan: parsed.value, model: result.model, usage: result.usage }
}

/** Pays for a written plan, then saves it — see `payThenSave`. */
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
    feature: 'VIDEO_PLAN',
    provider: provider.name,
    model: written.model,
    usage: written.usage,
    metadata,
    save,
  })
}

/**
 * Writes a video plan and saves it. The saved video's render status stays
 * NOT_CONFIGURED: a plan was written, nothing was rendered.
 */
export async function generateVideoPlan(
  request: VideoRequest,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<VideoOutcome> {
  const product = request.productId ? await productContext(request.productId, actor.workspaceId) : null
  if (request.productId && !product) return { ok: false, status: 404, message: 'That product does not exist.' }

  const campaign = request.campaignId ? await campaignContext(request.campaignId, actor.workspaceId) : null
  if (request.campaignId && !campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }

  let concept: string | null = null
  if (request.conceptId) {
    const asset = await prisma.campaignAsset.findFirst({
      where: { id: request.conceptId, campaignId: campaign!.id, workspaceId: actor.workspaceId, kind: 'VIDEO_CONCEPT' },
      select: { title: true, body: true, meta: true },
    })
    if (!asset) return { ok: false, status: 404, message: 'That video concept does not exist.' }
    const hook = (asset.meta as { hook?: string } | null)?.hook
    concept = [asset.title, hook && `Hook: ${hook}`, asset.body].filter(Boolean).join('\n')
  }

  const brandId = product?.brandId ?? campaign?.brandId ?? (await defaultBrandId(actor.workspaceId))

  const written = await writePlan(
    {
      type: request.type,
      platform: request.platform,
      durationSeconds: request.durationSeconds,
      brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, brandId),
      product: product?.text,
      campaign: campaign?.text,
      concept,
      goal: request.goal,
      audience: request.audience,
      tone: request.tone,
      notes: request.notes,
    },
    actor,
    provider,
  )
  if (!written.ok) return written

  const settled = await settle(actor, provider, written, { type: request.type }, () =>
    prisma.video.create({
      data: {
        workspaceId: actor.workspaceId,
        campaignId: campaign?.id ?? null,
        productId: product?.id ?? null,
        type: request.type,
        platform: request.platform,
        durationSeconds: request.durationSeconds,
        goal: request.goal ?? null,
        audience: request.audience ?? null,
        tone: request.tone ?? null,
        title: written.plan.title,
        plan: written.plan as never,
        renderStatus: 'NOT_CONFIGURED',
        createdById: actor.userId,
      },
      select: { id: true },
    }),
  )
  if (!settled.ok) return settled
  return { ok: true, id: settled.value.id, charged: settled.charged }
}

/** Writes a new plan for an existing video, replacing the old one only on success. */
export async function regenerateVideoPlan(
  videoId: string,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<VideoOutcome> {
  const video = await prisma.video.findFirst({
    where: { id: videoId, workspaceId: actor.workspaceId },
    select: {
      id: true,
      type: true,
      platform: true,
      durationSeconds: true,
      goal: true,
      audience: true,
      tone: true,
      plan: true,
      productId: true,
      campaignId: true,
    },
  })
  if (!video) return { ok: false, status: 404, message: 'That video does not exist.' }

  const [product, campaign] = await Promise.all([
    video.productId ? productContext(video.productId, actor.workspaceId) : null,
    video.campaignId ? campaignContext(video.campaignId, actor.workspaceId) : null,
  ])
  const brandId = product?.brandId ?? campaign?.brandId ?? (await defaultBrandId(actor.workspaceId))
  const previous = videoPlanSchema.safeParse(video.plan)

  const written = await writePlan(
    {
      type: video.type as VideoType,
      platform: (video.platform ?? 'TIKTOK') as Platform,
      durationSeconds: video.durationSeconds ?? 30,
      brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, brandId),
      product: product?.text,
      campaign: campaign?.text,
      goal: video.goal,
      audience: video.audience,
      tone: video.tone,
      previous: previous.success ? planToText(previous.data) : null,
    },
    actor,
    provider,
  )
  if (!written.ok) return written

  const settled = await settle(actor, provider, written, { videoId: video.id }, () =>
    prisma.video.update({
      where: { id: video.id },
      data: { title: written.plan.title, plan: written.plan as never },
    }),
  )
  if (!settled.ok) return settled
  return { ok: true, id: video.id, charged: settled.charged }
}
