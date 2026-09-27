import { z } from 'zod'
import { PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import { extractJson, type ParseResult } from '@/lib/campaigns/plan'
import { formatCount, formatMoney, formatPercent, summarise, type MetricRecord, type Totals } from './metrics'

/**
 * Nexa Insights: the numbers, summarised, and what to do about them. Pure.
 *
 * The model sees aggregates only, never raw rows, and is told to cite only
 * figures it was given. Insights run on the workspace's own data — never on
 * demo data, where advice would be advice about numbers that are not real.
 */

function line(label: string, totals: Totals): string {
  const spend = Object.entries(totals.spend)
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(' + ')
  return [
    label,
    `impressions ${formatCount(totals.impressions)}`,
    `reach ${formatCount(totals.reach)}`,
    `clicks ${formatCount(totals.clicks)}`,
    `CTR ${formatPercent(totals.ctr)}`,
    `leads ${formatCount(totals.leads)}`,
    `conversions ${formatCount(totals.conversions)}`,
    `conversion rate ${formatPercent(totals.conversionRate)}`,
    spend && `spend ${spend}`,
    totals.cpcCents !== null && `CPC ${formatMoney(totals.cpcCents, totals.currency)}`,
    totals.cplCents !== null && `cost per lead ${formatMoney(totals.cplCents, totals.currency)}`,
  ]
    .filter(Boolean)
    .join(', ')
}

/** The figures the model is allowed to talk about, as plain lines. */
export function describeData(
  records: MetricRecord[],
  campaignNames: Map<string, string>,
  from: Date,
  to: Date,
): string {
  const mid = new Date((from.getTime() + to.getTime()) / 2)
  const byPlatform = new Map<Platform | null, MetricRecord[]>()
  const byCampaign = new Map<string | null, MetricRecord[]>()
  for (const record of records) {
    byPlatform.set(record.platform, [...(byPlatform.get(record.platform) ?? []), record])
    byCampaign.set(record.campaignId, [...(byCampaign.get(record.campaignId) ?? []), record])
  }

  return [
    `Period: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}.`,
    line('Overall:', summarise(records)),
    line('First half of the period:', summarise(records.filter((r) => r.date < mid))),
    line('Second half of the period:', summarise(records.filter((r) => r.date >= mid))),
    'By platform:',
    ...[...byPlatform.entries()].map(([platform, group]) => line(`- ${platform ? PLATFORM_LABEL[platform] : 'No platform'}:`, summarise(group))),
    byCampaign.size > 1 || !byCampaign.has(null) ? 'By campaign:' : null,
    ...(byCampaign.size > 1 || !byCampaign.has(null)
      ? [...byCampaign.entries()].map(([id, group]) => line(`- ${id ? campaignNames.get(id) ?? 'A campaign' : 'No campaign'}:`, summarise(group)))
      : []),
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildInsightsPrompt(data: string, brandBlock: string | null) {
  const system = [
    `You are Nexa, a performance-marketing analyst for a small business. You read
their results and say, plainly, what is working, what is not, and what to do
next. Cite only numbers that appear in the data you are given — never invent
benchmarks, industry averages or figures. If the data is too thin to support a
conclusion, say so instead of guessing.`,
    brandBlock,
    `Reply with ONE JSON object and nothing else. Shape:
{ "summary": string (two or three sentences),
  "findings": [ { "title": string, "detail": string } ] (2–5, each grounded in a specific number above),
  "actions": [ string ] (2–5 concrete next steps) }
Plain text only — no Markdown.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { system, user: `Here are the results:\n\n${data}` }
}

export const insightsSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  findings: z
    .array(z.object({ title: z.string().trim().min(1).max(160), detail: z.string().trim().min(1).max(800) }))
    .min(1)
    .transform((list) => list.slice(0, 5)),
  actions: z
    .array(z.string().trim().min(1).max(400))
    .min(1)
    .transform((list) => list.slice(0, 5)),
})

export type Insights = z.infer<typeof insightsSchema>

export function parseInsights(reply: string): ParseResult<Insights> {
  const json = extractJson(reply)
  if (!json) return { ok: false, reason: 'not_json' }
  const parsed = insightsSchema.safeParse(json)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'invalid' }
}
