import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { creditCost, planAllows } from '@/lib/billing/plans'
import { CALENDAR_NOTICE, monthKey, monthWindow, parseMonth } from '@/lib/calendar/plan'
import { LinkButton } from '@/components/ui/Button'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { PlanLock } from '@/components/app/PlanLock'
import { CalendarBoard } from '@/components/calendar/CalendarBoard'
import { ImportCampaignButton, PlanWithAiButton } from '@/components/calendar/PlanDialogs'

export const metadata: Metadata = {
  title: 'Marketing Calendar',
  robots: { index: false, follow: false },
}

export default async function CalendarPage(props: PageProps<'/calendar'>) {
  const { workspace } = await requireWorkspace()
  const search = await props.searchParams
  const { year, month } = parseMonth(search.month, new Date())
  const { from, to } = monthWindow(year, month)
  const allowed = planAllows(workspace.plan, 'contentCalendar')

  const [items, campaigns, credits] = await Promise.all([
    prisma.calendarItem.findMany({
      where: { workspaceId: workspace.id, scheduledFor: { gte: from, lt: to } },
      orderBy: { scheduledFor: 'asc' },
      take: 500,
      select: {
        id: true,
        scheduledFor: true,
        title: true,
        notes: true,
        platform: true,
        format: true,
        status: true,
        contentId: true,
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.campaign.findMany({
      where: {
        workspaceId: workspace.id,
        status: { not: 'ARCHIVED' },
        assets: { some: { kind: 'CONTENT_CALENDAR' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, name: true },
    }),
    getCreditSnapshot(workspace.id, workspace.plan),
  ])

  const title = new Date(Date.UTC(year, month, 15)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <PageBody wide>
      <PageHeader
        title="Marketing Calendar"
        description="What goes out, where, and when."
        actions={
          allowed ? (
            <>
              {campaigns.length > 0 && <ImportCampaignButton campaigns={campaigns} />}
              <PlanWithAiButton campaigns={campaigns} cost={creditCost('CALENDAR')} balance={credits.balance} />
            </>
          ) : null
        }
      />

      <p className="mb-5 text-[13px] text-ink-500">{CALENDAR_NOTICE}</p>

      {!allowed && (
        <div className="mb-5">
          <PlanLock plan={workspace.plan} feature="contentCalendar" what="The marketing calendar" />
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <LinkButton href={`/calendar?month=${monthKey(year, month - 1)}`} variant="secondary" size="sm" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </LinkButton>
        <LinkButton href={`/calendar?month=${monthKey(year, month + 1)}`} variant="secondary" size="sm" aria-label="Next month">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </LinkButton>
        <h2 className="ml-1 text-[17px] font-semibold text-ink-900">{title}</h2>
        <LinkButton href="/calendar" variant="ghost" size="sm" className="ml-auto">
          Today
        </LinkButton>
      </div>

      <CalendarBoard
        year={year}
        month={month}
        canCreate={allowed}
        items={items.map((item) => ({ ...item, scheduledFor: item.scheduledFor.toISOString() }))}
      />
    </PageBody>
  )
}
