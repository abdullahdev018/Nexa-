import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, FlaskConical, PlugZap } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost, planAllows } from '@/lib/billing/plans'
import { PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import {
  RANGES,
  SERIES_METRICS,
  breakdown,
  dailySeries,
  formatCount,
  formatMoney,
  formatPercent,
  rangeWindow,
  summarise,
  viewSources,
  type AnalyticsView,
  type SeriesMetric,
  type Totals,
} from '@/lib/analytics/metrics'
import { loadRecords } from '@/lib/analytics/service'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { PlanLock } from '@/components/app/PlanLock'
import { TrendChart } from '@/components/analytics/TrendChart'
import { ImportButton, SourceActions } from '@/components/analytics/DataControls'
import { InsightsPanel } from '@/components/analytics/InsightsPanel'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
}

const METRIC_LABEL: Record<SeriesMetric, string> = {
  clicks: 'Clicks',
  impressions: 'Impressions',
  reach: 'Reach',
  leads: 'Leads',
  conversions: 'Conversions',
  spendCents: 'Spend',
}

/** Ad platforms Nexa could one day read from. None is connected, and the page says so. */
const CONNECTIONS = ['Meta Ads', 'Google Ads', 'TikTok Ads']

export default async function AnalyticsPage(props: PageProps<'/analytics'>) {
  const { workspace } = await requireWorkspace()
  const search = await props.searchParams
  const allowed = planAllows(workspace.plan, 'analytics')

  const view: AnalyticsView = search.view === 'demo' ? 'demo' : 'real'
  const { key: range, from, to } = rangeWindow(search.range)
  const metric = SERIES_METRICS.find((value) => value === search.metric) ?? 'clicks'
  const campaignFilter = typeof search.campaign === 'string' ? search.campaign : null

  const [records, counts, campaigns, credits] = await Promise.all([
    loadRecords(workspace.id, view, from, to, campaignFilter),
    prisma.analyticsRecord.groupBy({ by: ['source'], where: { workspaceId: workspace.id }, _count: { _all: true } }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, name: true },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])

  const countOf = (source: string) => counts.find((row) => row.source === source)?._count._all ?? 0
  const hasImported = countOf('IMPORTED') > 0
  const hasDemo = countOf('DEMO') > 0
  const viewHasAny = viewSources(view).some((source) => countOf(source) > 0)
  const campaignNames = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]))

  const totals = summarise(records)
  const series = dailySeries(records, metric, from, to)
  const seriesCurrency = metric === 'spendCents' ? totals.currency : null
  const byPlatform = breakdown(records, (record) => record.platform)
  const byCampaign = breakdown(records, (record) => record.campaignId)
  const campaignsWithData = [...new Set(records.map((record) => record.campaignId).filter(Boolean))] as string[]

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams()
    const next = { view: view === 'demo' ? 'demo' : null, range, metric: metric === 'clicks' ? null : metric, campaign: campaignFilter, ...patch }
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const query = params.toString()
    return query ? `/analytics?${query}` : '/analytics'
  }

  return (
    <PageBody wide>
      <PageHeader
        title="Analytics"
        description="Reach, clicks, leads and spend — from numbers you bring in."
        actions={
          allowed ? (
            <>
              <SourceActions view={view} hasImported={hasImported} hasDemo={hasDemo} />
              {view === 'real' && <ImportButton campaigns={campaigns} />}
            </>
          ) : null
        }
      />

      {!allowed && (
        <div className="mb-6">
          <PlanLock plan={workspace.plan} feature="analytics" what="Analytics" />
        </div>
      )}

      <nav aria-label="Data" className="mb-5 inline-flex rounded-lg bg-ink-100 p-1">
        {(['real', 'demo'] as const).map((option) => (
          <Link
            key={option}
            href={option === 'demo' ? '/analytics?view=demo' : '/analytics'}
            aria-current={view === option ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              view === option ? 'bg-raised text-ink-900 shadow-xs' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {option === 'real' ? 'Your data' : 'Demo data'}
          </Link>
        ))}
      </nav>

      {view === 'demo' ? (
        <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="text-[13.5px] leading-relaxed text-ink-800">
            <p className="font-semibold text-ink-900">Demo data — sample numbers, not your results.</p>
            <p>
              Generated to show how this page works. They are never added to your own data, never counted on the
              dashboard, and Nexa Insights does not run on them.
            </p>
          </div>
        </div>
      ) : (
        <section aria-label="Connections" className="mb-6 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
          <div className="flex items-start gap-3">
            <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
            <div className="min-w-0 text-[13.5px] text-ink-700">
              <p>
                <span className="font-medium text-ink-900">No ad account is connected.</span> Nexa cannot pull live
                results yet, so everything here is what you imported. Export a report from your ad manager and use
                Import results.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {CONNECTIONS.map((name) => (
                  <li key={name} className="rounded-full bg-raised px-2.5 py-0.5 text-[12px] text-ink-600 ring-1 ring-ink-200">
                    {name} · not connected
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {!viewHasAny ? (
        <EmptyState
          icon={view === 'demo' ? FlaskConical : BarChart3}
          title={view === 'demo' ? 'No demo data loaded' : 'No results yet'}
          description={
            view === 'demo'
              ? 'Load sample numbers to see what this page does. They stay here, in the demo view, and never mix with your own.'
              : 'Import a CSV from Meta, Google or TikTok and your reach, clicks, leads and spend appear here — with Nexa Insights on top.'
          }
          action={
            view === 'real' ? (
              <Link href="/analytics?view=demo" className="text-[13.5px] font-medium text-brand-600 hover:underline">
                Or look around with demo data →
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((option) => (
              <Chip key={option} href={href({ range: option })} active={range === option}>
                Last {RANGES[option]} days
              </Chip>
            ))}
            {campaignsWithData.length > 0 || campaignFilter ? (
              <>
                <span aria-hidden="true" className="mx-1 h-4 w-px bg-ink-300" />
                <Chip href={href({ campaign: null })} active={!campaignFilter}>
                  All campaigns
                </Chip>
                {(campaignFilter && !campaignsWithData.includes(campaignFilter) ? [campaignFilter, ...campaignsWithData] : campaignsWithData)
                  .slice(0, 6)
                  .map((id) => (
                    <Chip key={id} href={href({ campaign: id })} active={campaignFilter === id}>
                      {campaignNames.get(id) ?? 'Campaign'}
                    </Chip>
                  ))}
              </>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="rounded-xl bg-ink-50 p-6 text-center text-[14px] text-ink-600 ring-1 ring-ink-200">
              Nothing in this period. Try a longer range.
            </p>
          ) : (
            <div className="space-y-6">
              <StatTiles totals={totals} />

              <section aria-labelledby="trend-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="trend-heading" className="text-[15px] font-semibold text-ink-900">
                    {METRIC_LABEL[metric]} per day
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {SERIES_METRICS.map((option) => (
                      <Chip key={option} href={href({ metric: option })} active={metric === option} small>
                        {METRIC_LABEL[option]}
                      </Chip>
                    ))}
                  </div>
                </div>
                {metric === 'spendCents' && !totals.currency ? (
                  <p className="text-[13.5px] text-ink-600">
                    Spend is in more than one currency, so it is not drawn as one line. See the totals above.
                  </p>
                ) : (
                  <TrendChart series={series} label={METRIC_LABEL[metric]} currency={seriesCurrency} />
                )}
              </section>

              <div className="grid gap-6 xl:grid-cols-2">
                <BreakdownTable
                  title="By platform"
                  rows={byPlatform.map((row) => ({ label: row.key ? PLATFORM_LABEL[row.key as Platform] : 'No platform', totals: row.totals }))}
                />
                <BreakdownTable
                  title="By campaign"
                  rows={byCampaign.map((row) => ({ label: row.key ? campaignNames.get(row.key) ?? 'Deleted campaign' : 'No campaign', totals: row.totals }))}
                />
              </div>

              {view === 'real' && allowed && (
                <InsightsPanel range={range} campaignId={campaignFilter} cost={creditCost('INSIGHTS')} balance={credits.balance} />
              )}
            </div>
          )}
        </>
      )}
    </PageBody>
  )
}

function Chip({ href, active, small, children }: { href: string; active: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full font-medium transition-colors',
        small ? 'px-2 py-0.5 text-[12px]' : 'px-2.5 py-1 text-[12.5px]',
        active ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
      )}
    >
      {children}
    </Link>
  )
}

function spendText(totals: Totals): string {
  const entries = Object.entries(totals.spend)
  if (entries.length === 0) return formatMoney(0, 'USD')
  return entries.map(([currency, cents]) => formatMoney(cents, currency)).join(' + ')
}

function StatTiles({ totals }: { totals: Totals }) {
  const tiles = [
    { label: 'Impressions', value: formatCount(totals.impressions) },
    { label: 'Reach', value: formatCount(totals.reach) },
    { label: 'Clicks', value: formatCount(totals.clicks), hint: `CTR ${formatPercent(totals.ctr)}` },
    { label: 'Leads', value: formatCount(totals.leads), hint: `Cost per lead ${formatMoney(totals.cplCents, totals.currency)}` },
    { label: 'Conversions', value: formatCount(totals.conversions), hint: `Rate ${formatPercent(totals.conversionRate)}` },
    {
      label: 'Spend',
      value: spendText(totals),
      hint: totals.currency ? `CPC ${formatMoney(totals.cpcCents, totals.currency)}` : Object.keys(totals.spend).length > 1 ? 'Several currencies — not combined' : undefined,
    },
  ]
  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-ink-200 bg-raised p-4 shadow-xs">
          <p className="text-[12.5px] font-medium text-ink-500">{tile.label}</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-ink-900" title={tile.value}>
            {tile.value}
          </p>
          {tile.hint && <p className="mt-1 text-[12px] text-ink-500">{tile.hint}</p>}
        </div>
      ))}
    </section>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: { label: string; totals: Totals }[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-raised shadow-xs">
      <h2 className="border-b border-ink-200 px-4 py-3 text-[15px] font-semibold text-ink-900">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium" />
              {['Impressions', 'Clicks', 'CTR', 'Leads', 'Conv.', 'Spend', 'CPC'].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 text-right font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-ink-100">
                <th scope="row" className="px-4 py-2 font-medium text-ink-900">
                  {row.label}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.totals.impressions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.totals.clicks)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.totals.ctr)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.totals.leads)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.totals.conversions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{spendText(row.totals)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.totals.cpcCents, row.totals.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
