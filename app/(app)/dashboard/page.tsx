import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, CalendarDays, Clapperboard, FileText, Megaphone, Palette, Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { getPlan } from '@/lib/billing/plans'
import { formatCount, rangeWindow, summarise, viewSources } from '@/lib/analytics/metrics'
import { LinkButton } from '@/components/ui/Button'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { EmptyState } from '@/components/app/EmptyState'
import { StatCard } from '@/components/dashboard/StatCard'
import { WorkflowStrip } from '@/components/dashboard/WorkflowStrip'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspace()
  const scope = { workspaceId: workspace.id }

  // Every count is a real count of this workspace's rows. On a new account
  // they are all zero, and the page says zero — there is no seeded sample
  // data pretending the workspace has history.
  const [
    activeCampaigns,
    totalCampaigns,
    contentCount,
    videoPlans,
    videosRendered,
    scheduledPosts,
    realAnalytics,
    recentCampaigns,
    credits,
    brandCount,
  ] = await Promise.all([
    prisma.campaign.count({ where: { ...scope, status: { in: ['READY', 'ACTIVE'] } } }),
    prisma.campaign.count({ where: scope }),
    prisma.content.count({ where: scope }),
    prisma.video.count({ where: scope }),
    prisma.video.count({ where: { ...scope, renderStatus: 'READY' } }),
    // Upcoming items on the calendar. Nexa posts none of them; the user does.
    prisma.calendarItem.count({ where: { ...scope, scheduledFor: { gte: new Date() }, publishedAt: null } }),
    // The workspace's own numbers only. Demo data is never counted here.
    prisma.analyticsRecord.findMany({
      where: { ...scope, source: { in: viewSources('real') }, date: { gte: rangeWindow('30d').from } },
      select: { date: true, platform: true, campaignId: true, reach: true, impressions: true, clicks: true, leads: true, conversions: true, spendCents: true, currency: true },
    }),
    prisma.campaign.findMany({
      where: scope,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, name: true, status: true, goal: true, updatedAt: true },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
    prisma.brand.count({ where: scope }),
  ])

  const realTotals = summarise(realAnalytics)
  const firstName = user.name?.trim().split(/\s+/)[0]
  const used = Math.max(0, credits.monthlyAllowance - credits.balance)
  const usedPercent =
    credits.monthlyAllowance > 0 ? Math.round((used / credits.monthlyAllowance) * 100) : 0

  return (
    <PageBody wide>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description={`${workspace.name} · ${getPlan(workspace.plan).name} plan`}
        actions={
          <>
            <LinkButton href="/campaigns/new" size="md">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Campaign
            </LinkButton>
            <LinkButton href="/content/new" size="md" variant="secondary">
              Create Content
            </LinkButton>
          </>
        }
      />

      {brandCount === 0 && (
        <Link
          href="/brand/new"
          className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100"
        >
          <Palette className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink-900">Set up your brand first</span>
            <span className="block text-[13px] text-ink-600">
              Tell Nexa who you are and who you sell to, so everything it writes sounds like you.
            </span>
          </span>
          <span className="shrink-0 text-[13.5px] font-medium text-brand-700">Start →</span>
        </Link>
      )}

      <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active campaigns"
          value={activeCampaigns}
          icon={Megaphone}
          href="/campaigns"
          hint={totalCampaigns > 0 ? `${totalCampaigns} in total` : 'None yet'}
        />
        <StatCard
          label="Content created"
          value={contentCount}
          icon={FileText}
          href="/content"
          hint={contentCount > 0 ? 'Across all platforms' : 'None yet'}
        />
        <StatCard
          label="Video plans"
          value={videoPlans}
          icon={Clapperboard}
          href="/video"
          // Named "plans", not "videos generated": Nexa writes the plan, and a
          // rendered file only exists once a video provider is connected.
          hint={
            videosRendered > 0
              ? `${videosRendered} rendered`
              : 'Scripts and shot plans — no renderer connected'
          }
        />
        <StatCard
          label="Planned posts"
          value={scheduledPosts}
          icon={CalendarDays}
          href="/calendar"
          hint={scheduledPosts > 0 ? 'Upcoming, in your calendar' : 'Nothing planned'}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section
          aria-label="Campaign performance"
          className="rounded-xl border border-ink-200 bg-raised p-5 shadow-xs lg:col-span-2"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-900">Campaign performance</h2>
            <BarChart3 className="h-4 w-4 text-ink-400" aria-hidden="true" />
          </div>

          {realAnalytics.length === 0 ? (
            <div className="mt-4 rounded-lg bg-ink-50 p-4 ring-1 ring-ink-200">
              <p className="text-[14px] font-medium text-ink-800">No results yet</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">
                Nexa is not connected to any ad or analytics account. Import a report from
                your ad manager to see your results here. Nothing here is estimated or simulated.
              </p>
              <Link
                href="/analytics"
                className="mt-3 inline-block text-[13.5px] font-medium text-brand-600 hover:underline"
              >
                Go to Analytics →
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              <dl className="grid grid-cols-3 gap-3">
                {[
                  ['Impressions', formatCount(realTotals.impressions)],
                  ['Clicks', formatCount(realTotals.clicks)],
                  ['Leads', formatCount(realTotals.leads)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[12.5px] text-ink-500">{label}</dt>
                    <dd className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12.5px] text-ink-500">
                Last 30 days, from your imported results.{' '}
                <Link href="/analytics" className="font-medium text-brand-600 hover:underline">
                  Open Analytics
                </Link>
              </p>
            </div>
          )}
        </section>

        <section
          aria-label="Credits"
          className="rounded-xl border border-ink-200 bg-raised p-5 shadow-xs"
        >
          <h2 className="text-[15px] font-semibold text-ink-900">AI credits</h2>
          <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink-900 tabular-nums">
            {credits.balance.toLocaleString()}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-500">
            of {credits.monthlyAllowance.toLocaleString()} this period
          </p>

          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-200"
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={credits.monthlyAllowance}
            aria-label="Credits used this period"
          >
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${usedPercent}%` }} />
          </div>

          <p className="mt-3 text-[12.5px] text-ink-500">
            Renews{' '}
            {credits.periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </section>
      </div>

      <section aria-label="Campaigns" className="mt-8">
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-[15px] font-semibold text-ink-900">Recent campaigns</h2>
          {recentCampaigns.length > 0 && (
            <Link href="/campaigns" className="text-[13.5px] font-medium text-brand-600 hover:underline">
              View all
            </Link>
          )}
        </div>

        {recentCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-ink-200 bg-raised p-6 shadow-xs sm:p-8">
            <h3 className="text-[17px] font-semibold tracking-tight text-ink-900">
              One brief. Your entire marketing campaign.
            </h3>
            <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-600">
              Give Nexa your product and it builds the strategy, the hooks, the content,
              the video plans and the ad copy around it.
            </p>

            <div className="mt-5">
              <WorkflowStrip />
            </div>

            <div className="mt-6">
              <LinkButton href="/campaigns/new" size="lg">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create your first campaign
              </LinkButton>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-raised shadow-xs">
            {recentCampaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-ink-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium text-ink-900">
                      {campaign.name}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-500">
                      {campaign.goal.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-600">
                    {campaign.status.toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {contentCount === 0 && recentCampaigns.length > 0 && (
        <section className="mt-8">
          <EmptyState
            icon={FileText}
            title="No content yet"
            description="Turn a campaign into posts, reels and captions in the Content Studio."
            action={
              <LinkButton href="/content/new" size="md" variant="secondary">
                Open Content Studio
              </LinkButton>
            }
          />
        </section>
      )}
    </PageBody>
  )
}
