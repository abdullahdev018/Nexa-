import { Lock } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { PageBody, PageHeader } from './PageHeader'
import { navItem } from '@/lib/content/navigation'
import { getPlan, planAllows, PLAN_LIST, type PlanId } from '@/lib/billing/plans'
import { ComingSoon } from '@/components/ui/ComingSoon'

/**
 * A section that is not built yet.
 *
 * It says so plainly rather than showing a mock dashboard. Nothing here
 * pretends to hold data, and there is no button that looks like it works and
 * does not — an unbuilt section that looks finished is the exact failure this
 * product is meant to avoid.
 */
export function SectionPlaceholder({
  href,
  plan,
  detail,
}: {
  href: string
  plan: PlanId
  /** What the section will do, in the user's terms. */
  detail: string[]
}) {
  const item = navItem(href)
  if (!item) return null

  const Icon = item.icon
  const locked = item.requires ? !planAllows(plan, item.requires) : false
  const needed = item.requires
    ? PLAN_LIST.find((candidate) => planAllows(candidate.id, item.requires!))
    : undefined

  return (
    <PageBody>
      <PageHeader title={item.label} description={item.description} />

      <div className="rounded-2xl border border-ink-200 bg-raised p-6 shadow-xs sm:p-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <ComingSoon />
            <p className="text-[13.5px] text-ink-600">
              This section is still being built. Nothing below is live yet.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-ink-200 pt-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">
            What it will do
          </p>
          <ul className="mt-3 space-y-2">
            {detail.map((line) => (
              <li key={line} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-700">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {locked && needed && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
            <p className="inline-flex items-center gap-2 text-[13.5px] text-ink-700">
              <Lock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
              Included from {needed.name}. You are on {getPlan(plan).name}.
            </p>
            <LinkButton href="/billing#plans-heading" size="sm" variant="secondary">
              Compare plans
            </LinkButton>
          </div>
        )}
      </div>
    </PageBody>
  )
}
