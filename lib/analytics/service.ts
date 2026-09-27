import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { getProvider, type AIProvider } from '@/lib/ai'
import { generateText } from '@/lib/ai/generate'
import { recordAIUsage } from '@/lib/billing/credits'
import { payThenSave } from '@/lib/billing/settle'
import { PLAN_LIST, getPlan, planAllows, type PlanId } from '@/lib/billing/plans'
import { loadBrandContext } from '@/lib/brand/queries'
import { defaultBrandId } from '@/lib/campaigns/context'
import type { GenerationActor } from '@/lib/campaigns/generate'
import type { Platform } from '@/lib/campaigns/options'
import { apiError } from '@/lib/utils/api'
import { buildInsightsPrompt, describeData, parseInsights, type Insights } from './insights'
import { demoRecords, viewSources, type AnalyticsView, type ImportRow, type MetricRecord } from './metrics'

export const DEMO_DAYS = 60

const RECORD_SELECT = {
  date: true,
  platform: true,
  campaignId: true,
  reach: true,
  impressions: true,
  clicks: true,
  leads: true,
  conversions: true,
  spendCents: true,
  currency: true,
} as const

export function analyticsLockedError(plan: PlanId) {
  if (planAllows(plan, 'analytics')) return null
  const needed = PLAN_LIST.find((candidate) => planAllows(candidate.id, 'analytics'))
  return apiError(`Analytics is included from ${needed?.name ?? 'a paid plan'}. You are on ${getPlan(plan).name}.`, 403)
}

/**
 * The only way records are read. The view decides the sources — real or
 * demo, never both — so no caller can add demo numbers to real ones.
 */
export async function loadRecords(
  workspaceId: string,
  view: AnalyticsView,
  from: Date,
  to: Date,
  campaignId?: string | null,
): Promise<MetricRecord[]> {
  return prisma.analyticsRecord.findMany({
    where: {
      workspaceId,
      source: { in: viewSources(view) },
      date: { gte: from, lte: to },
      ...(campaignId && { campaignId }),
    },
    orderBy: { date: 'asc' },
    take: 20_000,
    select: RECORD_SELECT,
  })
}

/** Saves imported rows. Each is stored at midday UTC on its date, so it never slips a day. */
export async function importRows(workspaceId: string, rows: ImportRow[], campaignId: string | null): Promise<number> {
  const { count } = await prisma.analyticsRecord.createMany({
    data: rows.map(({ date, ...row }) => ({
      ...row,
      date: new Date(`${date}T12:00:00Z`),
      workspaceId,
      campaignId,
      source: 'IMPORTED' as const,
    })),
  })
  return count
}

/** Replaces the workspace's demo data with a fresh sample. Touches no other source. */
export async function seedDemo(workspaceId: string): Promise<number> {
  const campaigns = await prisma.campaign.findMany({ where: { workspaceId }, select: { platforms: true }, take: 20 })
  const platforms = [...new Set(campaigns.flatMap((campaign) => campaign.platforms))].slice(0, 3) as Platform[]
  const records = demoRecords(workspaceId, platforms, DEMO_DAYS)

  const [, created] = await prisma.$transaction([
    prisma.analyticsRecord.deleteMany({ where: { workspaceId, source: 'DEMO' } }),
    prisma.analyticsRecord.createMany({
      data: records.map((record) => ({ ...record, workspaceId, source: 'DEMO' as const })),
    }),
  ])
  return created.count
}

/**
 * Clears imported or demo records. Connected records belong to their
 * integration and are never cleared from here.
 */
export async function clearSource(workspaceId: string, source: 'IMPORTED' | 'DEMO'): Promise<number> {
  const { count } = await prisma.analyticsRecord.deleteMany({ where: { workspaceId, source } })
  return count
}

/** Reads the workspace's own numbers and says what they mean. Never runs on demo data. */
export async function runInsights(
  options: { from: Date; to: Date; campaignId: string | null },
  actor: GenerationActor,
  provider: AIProvider = getProvider(),
): Promise<{ ok: true; insights: Insights; charged: number } | { ok: false; status: number; message: string }> {
  const records = await loadRecords(actor.workspaceId, 'real', options.from, options.to, options.campaignId)
  if (records.length === 0) {
    return { ok: false, status: 422, message: 'There are no results in this period to read. Import your numbers first.' }
  }

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: actor.workspaceId, id: { in: [...new Set(records.map((r) => r.campaignId).filter(Boolean))] as string[] } },
    select: { id: true, name: true },
  })
  const { system, user } = buildInsightsPrompt(
    describeData(records, new Map(campaigns.map((c) => [c.id, c.name])), options.from, options.to),
    await loadBrandContext(actor.workspaceId, actor.plan, await defaultBrandId(actor.workspaceId)),
  )

  const result = await generateText(provider, { modelId: 'nexa-balanced', systemPrompt: system, prompt: user })
  const parsed = result.ok ? parseInsights(result.text) : null
  if (!result.ok || !parsed?.ok) {
    await recordAIUsage({
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      feature: 'INSIGHTS',
      provider: provider.name,
      model: result.model,
      success: false,
      errorKind: result.ok ? 'parse_failed' : 'generation_failed',
    })
    return {
      ok: false,
      status: result.ok ? 502 : result.status,
      message: result.ok ? 'Nexa could not read these results this time. Nothing was charged — try again.' : result.message,
    }
  }

  // Nothing is stored, but the reading is still only handed over once paid for.
  const settled = await payThenSave({
    workspaceId: actor.workspaceId,
    plan: actor.plan,
    userId: actor.userId,
    feature: 'INSIGHTS',
    provider: provider.name,
    model: result.model,
    usage: result.usage,
    metadata: { records: records.length },
    save: async () => parsed.value,
  })
  if (!settled.ok) return settled
  return { ok: true, insights: settled.value, charged: settled.charged }
}
