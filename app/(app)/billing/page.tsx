import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { canAdminister, requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { formatPrice, getPlan } from '@/lib/billing/plans'
import { devPlanSwitchEnabled, payments } from '@/lib/billing/payments'
import { daysUntil, priceList, usageByReason } from '@/lib/billing/usage'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { PlanCards } from '@/components/billing/PlanCards'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Billing & credits',
  robots: { index: false, follow: false },
}

const PAGE_SIZE = 25

const KIND_LABEL = {
  GRANT: 'Granted',
  SPEND: 'Spent',
  REFUND: 'Refunded',
  ADJUSTMENT: 'Adjusted',
  EXPIRY: 'Expired',
} as const

function shortDate(date: Date, withTime = false): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime && { hour: 'numeric', minute: '2-digit' }),
  })
}

export default async function BillingPage(props: PageProps<'/billing'>) {
  const { workspace, role } = await requireWorkspace()
  const search = await props.searchParams
  const page = Math.max(1, Math.min(1000, Number(search.page) || 1))

  const credits = await getCreditSnapshot(workspace.id, workspace.plan)
  const [subscription, periodRows, failed, history, historyCount] = await Promise.all([
    prisma.subscription.findUnique({
      where: { workspaceId: workspace.id },
      select: { provider: true, status: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
    prisma.creditTransaction.findMany({
      where: { workspaceId: workspace.id, createdAt: { gte: credits.periodStart } },
      select: { amount: true, kind: true, reason: true },
    }),
    prisma.aIUsage.count({ where: { workspaceId: workspace.id, success: false, createdAt: { gte: credits.periodStart } } }),
    prisma.creditTransaction.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        amount: true,
        kind: true,
        reason: true,
        balanceAfter: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.creditTransaction.count({ where: { workspaceId: workspace.id } }),
  ])

  const plan = getPlan(workspace.plan)
  const usage = usageByReason(periodRows)
  const spent = usage.reduce((total, line) => total + line.credits, 0)
  const prices = priceList(credits.balance)
  const pages = Math.max(1, Math.ceil(historyCount / PAGE_SIZE))
  const percentLeft = credits.monthlyAllowance > 0 ? Math.round((Math.max(0, credits.balance) / credits.monthlyAllowance) * 100) : 0
  const paid = Boolean(subscription?.provider)

  return (
    <PageBody wide>
      <PageHeader title="Billing & credits" description={`${workspace.name} · what you are on, what you have left, and where it went.`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="plan-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
          <h2 id="plan-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Plan</h2>
          <p className="mt-2 text-[24px] font-semibold tracking-tight text-ink-900">{plan.name}</p>
          <p className="mt-1 text-[14px] text-ink-600">
            {plan.monthlyPriceCents === 0 ? 'Free' : `${formatPrice(plan.monthlyPriceCents)} a month`} ·{' '}
            {plan.monthlyCredits.toLocaleString()} credits a month
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            {workspace.plan === 'FREE'
              ? 'No payment is taken on the Free plan.'
              : paid
                ? `Billed ${subscription?.interval === 'YEARLY' ? 'yearly' : 'monthly'} through ${subscription?.provider}.`
                : 'This plan was granted to the workspace. It has not been paid for through Nexa.'}
          </p>
        </section>

        <section aria-labelledby="credits-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
          <h2 id="credits-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Credits this period</h2>
          <p className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums text-ink-900">
            {credits.balance.toLocaleString()}
            <span className="text-[14px] font-normal text-ink-500"> of {credits.monthlyAllowance.toLocaleString()} left</span>
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-ink-200"
            role="progressbar"
            aria-valuenow={Math.max(0, credits.balance)}
            aria-valuemin={0}
            aria-valuemax={credits.monthlyAllowance}
            aria-label="Credits left this period"
          >
            <div className={cn('h-full rounded-full', percentLeft <= 15 ? 'bg-warn-text' : 'bg-brand-600')} style={{ width: `${percentLeft}%` }} />
          </div>
          <p className="mt-3 text-[13px] text-ink-500">
            {shortDate(credits.periodStart)} – {shortDate(credits.periodEnd)} · renews in {daysUntil(credits.periodEnd)} day
            {daysUntil(credits.periodEnd) === 1 ? '' : 's'}. Unused credits do not roll over.
          </p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="usage-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
          <h2 id="usage-heading" className="text-[15px] font-semibold text-ink-900">Where this period&apos;s credits went</h2>
          {usage.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-600">Nothing spent yet this period.</p>
          ) : (
            <table className="mt-3 w-full text-left text-[13.5px]">
              <thead className="text-ink-500">
                <tr>
                  <th scope="col" className="pb-2 font-medium">For</th>
                  <th scope="col" className="pb-2 text-right font-medium">Times</th>
                  <th scope="col" className="pb-2 text-right font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((line) => (
                  <tr key={line.reason} className="border-t border-ink-100">
                    <th scope="row" className="py-1.5 font-normal text-ink-800">{line.reason}</th>
                    <td className="py-1.5 text-right tabular-nums text-ink-700">{line.times}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-900">{line.credits.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t border-ink-200 font-medium">
                  <th scope="row" className="py-1.5 text-ink-900">Total</th>
                  <td />
                  <td className="py-1.5 text-right tabular-nums text-ink-900">{spent.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          )}
          {failed > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-500">
              {failed} generation{failed === 1 ? '' : 's'} failed this period and {failed === 1 ? 'was' : 'were'} not charged.
            </p>
          )}
        </section>

        <section aria-labelledby="prices-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
          <h2 id="prices-heading" className="text-[15px] font-semibold text-ink-900">What credits buy</h2>
          <p className="mt-1 text-[13px] text-ink-500">Charged only when a generation succeeds.</p>
          <table className="mt-3 w-full text-left text-[13.5px]">
            <thead className="text-ink-500">
              <tr>
                <th scope="col" className="pb-2 font-medium">Generation</th>
                <th scope="col" className="pb-2 text-right font-medium">Credits</th>
                <th scope="col" className="pb-2 text-right font-medium">You can still</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((line) => (
                <tr key={line.feature} className="border-t border-ink-100">
                  <th scope="row" className="py-1.5 font-normal text-ink-800">{line.label}</th>
                  <td className="py-1.5 text-right tabular-nums text-ink-700">{line.cost}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-900">{line.affordable.toLocaleString()}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-labelledby="plans-heading" className="mt-8">
        <h2 id="plans-heading" className="mb-3 text-[17px] font-semibold text-ink-900">Plans</h2>
        <PlanCards
          current={workspace.plan}
          paymentsExplanation={payments().explanation}
          devSwitch={devPlanSwitchEnabled()}
          canAdminister={canAdminister(role)}
        />
      </section>

      <section aria-labelledby="history-heading" className="mt-8">
        <h2 id="history-heading" className="mb-3 text-[17px] font-semibold text-ink-900">Credit history</h2>
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-raised shadow-xs">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">When</th>
                <th scope="col" className="px-4 py-2 font-medium">What</th>
                <th scope="col" className="px-4 py-2 font-medium">Who</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Change</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-t border-ink-100">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-600">{shortDate(row.createdAt, true)}</td>
                  <td className="px-4 py-2 text-ink-800">
                    <span className="mr-1.5 text-[11.5px] font-medium uppercase tracking-wide text-ink-500">{KIND_LABEL[row.kind]}</span>
                    {row.reason}
                  </td>
                  <td className="px-4 py-2 text-ink-600">{row.user ? row.user.name ?? row.user.email : 'Nexa'}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', row.amount < 0 ? 'text-ink-900' : 'text-success-text')}>
                    {row.amount > 0 ? '+' : ''}
                    {row.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-600">{row.balanceAfter.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav aria-label="History pages" className="mt-3 flex items-center justify-between text-[13px]">
            {page > 1 ? (
              <Link href={`/billing?page=${page - 1}`} className="font-medium text-brand-600 hover:underline">
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-500">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={`/billing?page=${page + 1}`} className="font-medium text-brand-600 hover:underline">
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </PageBody>
  )
}
