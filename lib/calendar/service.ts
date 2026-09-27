import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import { loadBrandContext } from '@/lib/brand/queries'
import { campaignContext, defaultBrandId } from '@/lib/campaigns/context'
import type { GenerationActor } from '@/lib/campaigns/generate'
import type { AssetMeta } from '@/lib/campaigns/plan'
import type { z } from 'zod'
import {
  buildCalendarPrompt,
  parseCalendarSlots,
  slotsToItems,
  type createItemSchema,
  type GenerateCalendarRequest,
  type PlannedItem,
} from './plan'

type Failure = { ok: false; status: number; message: string }

const CALENDAR_MODEL = 'nexa-balanced'

/**
 * Puts one item on the calendar. When it is a content piece, the piece is
 * marked SCHEDULED in the same transaction — the only place anything in the
 * app becomes SCHEDULED.
 */
export async function createItem(
  input: z.infer<typeof createItemSchema>,
  workspaceId: string,
): Promise<{ ok: true; id: string } | Failure> {
  if (!input.contentId) {
    const item = await prisma.calendarItem.create({
      data: {
        workspaceId,
        scheduledFor: input.scheduledFor,
        title: input.title!,
        platform: input.platform!,
        format: input.format!,
        notes: input.notes ?? null,
      },
      select: { id: true },
    })
    return { ok: true, id: item.id }
  }

  const content = await prisma.content.findFirst({
    where: { id: input.contentId, workspaceId },
    select: { id: true, title: true, topic: true, platform: true, format: true, status: true, campaignId: true },
  })
  if (!content) return { ok: false, status: 404, message: 'That content does not exist.' }
  if (content.status === 'PUBLISHED') {
    return { ok: false, status: 409, message: 'Published content is already out; it cannot be planned again.' }
  }

  const [item] = await prisma.$transaction([
    prisma.calendarItem.create({
      data: {
        workspaceId,
        contentId: content.id,
        campaignId: content.campaignId,
        scheduledFor: input.scheduledFor,
        title: input.title || content.title || content.topic || 'Untitled post',
        platform: content.platform,
        format: content.format,
        notes: input.notes ?? null,
        status: 'READY',
      },
      select: { id: true },
    }),
    prisma.content.update({ where: { id: content.id }, data: { status: 'SCHEDULED' } }),
  ])
  return { ok: true, id: item.id }
}

/**
 * Removes an item. A content piece that is no longer on the calendar at all
 * goes back to READY — it was ready enough to plan, and is still written.
 */
export async function deleteItem(id: string, workspaceId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.calendarItem.findFirst({ where: { id, workspaceId }, select: { id: true, contentId: true } })
    if (!item) return false
    await tx.calendarItem.delete({ where: { id: item.id } })

    if (item.contentId) {
      const remaining = await tx.calendarItem.count({ where: { contentId: item.contentId } })
      if (remaining === 0) {
        await tx.content.updateMany({
          where: { id: item.contentId, status: 'SCHEDULED' },
          data: { status: 'READY' },
        })
      }
    }
    return true
  })
}

async function saveItems(items: PlannedItem[], workspaceId: string, campaignId: string | null) {
  await prisma.calendarItem.createMany({
    data: items.map((item) => ({ ...item, workspaceId, campaignId, status: 'DRAFT' as const })),
  })
  return items.length
}

/**
 * Lays a generated campaign's 14-day calendar onto real dates. Free — nothing
 * is generated. Refuses a second import unless asked, so a double click does
 * not double the calendar.
 */
export async function importCampaign(
  options: { campaignId: string; start: Date; again: boolean },
  workspaceId: string,
): Promise<{ ok: true; created: number } | Failure> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: options.campaignId, workspaceId },
    select: {
      id: true,
      platforms: true,
      assets: {
        where: { kind: 'CONTENT_CALENDAR' },
        orderBy: { position: 'asc' },
        select: { title: true, body: true, meta: true },
      },
    },
  })
  if (!campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }
  if (campaign.assets.length === 0) {
    return { ok: false, status: 422, message: 'This campaign has no calendar to add. Generate it first.' }
  }

  const slots = campaign.assets.map((asset) => {
    const meta = (asset.meta ?? {}) as AssetMeta
    return {
      day: meta.day ?? 1,
      title: asset.title ?? asset.body.slice(0, 160),
      notes: asset.body || null,
      platform: meta.platform ?? null,
      format: meta.format ?? null,
    }
  })
  const items = slotsToItems(slots, options.start, campaign.platforms[0] ?? 'INSTAGRAM')

  return prisma.$transaction(async (tx) => {
    // Locks the campaign row, so two quick clicks are counted one after the
    // other and cannot both find the calendar empty.
    await tx.$executeRaw`SELECT 1 FROM "Campaign" WHERE "id" = ${campaign.id} FOR UPDATE`

    if (!options.again) {
      // Its own slots, by title: items planned with AI for the same campaign
      // are not a previous import and must not block one.
      const existing = await tx.calendarItem.count({
        where: { campaignId: campaign.id, workspaceId, title: { in: items.map((item) => item.title) } },
      })
      if (existing > 0) {
        return {
          ok: false as const,
          status: 409,
          message: `${existing} of this campaign's calendar slots are already on the calendar. Add it again only if you mean to repeat it.`,
        }
      }
    }

    await tx.calendarItem.createMany({
      data: items.map((item) => ({ ...item, workspaceId, campaignId: campaign.id, status: 'DRAFT' as const })),
    })
    return { ok: true as const, created: items.length }
  })
}

/** Plans weeks of posts with the model and saves them as draft items. */
export async function generateCalendar(
  request: GenerateCalendarRequest,
  startLabel: string,
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<{ ok: true; created: number; charged: number } | Failure> {
  const campaign = request.campaignId ? await campaignContext(request.campaignId, actor.workspaceId) : null
  if (request.campaignId && !campaign) return { ok: false, status: 404, message: 'That campaign does not exist.' }

  const brandId = campaign?.brandId ?? (await defaultBrandId(actor.workspaceId))
  const { system, user } = buildCalendarPrompt({
    request,
    brandBlock: await loadBrandContext(actor.workspaceId, actor.plan, brandId),
    campaign: campaign?.text ?? null,
    startLabel,
  })

  const result = await generateText(provider, { modelId: CALENDAR_MODEL, systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseCalendarSlots(result.text, request) : null

  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'CALENDAR',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? `parse_${parsed && !parsed.ok ? parsed.reason : 'failed'}` : 'generation_failed',
    })
    return {
      ok: false,
      status: result.ok ? 502 : result.status,
      message: result.ok
        ? 'Nexa could not plan a usable calendar this time. Nothing was charged — try again.'
        : result.message,
    }
  }

  const items = slotsToItems(parsed.value, request.start, request.platforms[0])
  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'CALENDAR',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { items: items.length },
    save: () => saveItems(items, actor.workspaceId, campaign?.id ?? null),
  })
  if (!settled.ok) return settled
  return { ok: true, created: settled.value, charged: settled.charged }
}
