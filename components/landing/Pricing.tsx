import { Check, Minus } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import {
  CREDIT_COSTS,
  CREDIT_FEATURE_LABEL,
  PLAN_LIST,
  TEAM_INVITES_BUILT,
  UNBUILT,
  creditFeatureBuilt,
  formatPrice,
  type CreditFeature,
  type PlanDefinition,
} from '@/lib/billing/plans'
import { NEXA_MODELS, canUseModel } from '@/lib/ai/models'
import { cn } from '@/lib/utils/cn'
import { HighlightLine } from '@/components/billing/HighlightLine'
import { Section, SectionHeading } from './Section'

/**
 * Every price, allowance and line on these cards comes from the plan config
 * the product enforces. Nothing is typed in here, so the page cannot sell
 * something the app does not do.
 */
export function PricingTable({
  withHeading = true,
  signedIn = false,
}: {
  withHeading?: boolean
  /** Signed-in visitors are sent to the app rather than back to sign-up. */
  signedIn?: boolean
}) {
  return (
    <div>
      {withHeading && (
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Grow into the full team."
          description="Every plan runs on monthly credits, charged only when a generation succeeds. Upgrade when you need more brands, video plans, research and analytics."
        />
      )}

      <div className="mt-14 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-raised p-7',
              plan.mostPopular ? 'border-brand-600 shadow-lg ring-1 ring-brand-600' : 'border-ink-200 shadow-xs',
            )}
          >
            {plan.mostPopular && (
              <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-[11.5px] font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-[15px] font-semibold text-ink-900">{plan.name}</h3>
            <p className="mt-1.5 min-h-[2.75rem] text-[14px] leading-relaxed text-ink-600">{plan.tagline}</p>
            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="text-[36px] font-semibold tracking-tight text-ink-900">{formatPrice(plan.monthlyPriceCents)}</span>
              <span className="text-[14px] text-ink-500">/ month</span>
            </p>
            <p className="mt-1 text-[12.5px] text-ink-500">
              {plan.yearlyPriceCents > 0 ? `or ${formatPrice(plan.yearlyPriceCents)} a year — two months free` : 'No card needed'}
            </p>

            <LinkButton
              href={signedIn ? '/billing' : '/signup'}
              variant={plan.mostPopular ? 'primary' : 'secondary'}
              size="lg"
              className="mt-6 w-full"
            >
              {signedIn ? 'See your plan' : 'Start free'}
            </LinkButton>

            <ul className="mt-6 space-y-2.5 border-t border-ink-200 pt-6">
              {plan.highlights.map((highlight) => (
                <HighlightLine key={highlight.text} highlight={highlight} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-[13.5px] leading-relaxed text-ink-500">
        Online checkout is not open yet, so every account starts on Free. The prices above are what each plan will
        cost when it opens — nothing is charged before then.
      </p>
    </div>
  )
}

export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <Section id="pricing" muted>
      <PricingTable signedIn={signedIn} />
    </Section>
  )
}

/** What each kind of generation costs, from the same table the app charges from. */
export function CreditCosts() {
  // Only what can be generated today; a price for an unbuilt feature is a promise.
  const rows = (Object.keys(CREDIT_COSTS) as CreditFeature[])
    .filter(creditFeatureBuilt)
    .sort((a, b) => CREDIT_COSTS[b] - CREDIT_COSTS[a])
  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-ink-200 bg-raised shadow-xs">
      <table className="w-full text-left text-[14px]">
        <caption className="border-b border-ink-200 px-5 py-4 text-left">
          <span className="block text-[16px] font-semibold text-ink-900">What credits buy</span>
          <span className="mt-0.5 block text-[13.5px] text-ink-600">Charged only when a generation succeeds.</span>
        </caption>
        <tbody>
          {rows.map((feature) => (
            <tr key={feature} className="border-t border-ink-100 first:border-t-0">
              <th scope="row" className="px-5 py-2.5 font-normal text-ink-800">
                {CREDIT_FEATURE_LABEL[feature]}
              </th>
              <td className="px-5 py-2.5 text-right tabular-nums font-medium text-ink-900">
                {CREDIT_COSTS[feature]} credit{CREDIT_COSTS[feature] === 1 ? '' : 's'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A row that is a plan capability not built yet shows "Soon" wherever it is included. */
const UNBUILT_ROWS = {
  competitorResearch: 'Competitor research',
  clientWorkspaces: 'Client workspaces',
  bulkGeneration: 'Bulk generation',
  whiteLabelReports: 'White-label reports',
} as const

const DEEP_MODEL = NEXA_MODELS.find((model) => model.id === 'nexa-deep')

const MATRIX: {
  label: string
  value: (plan: PlanDefinition) => string | boolean
  soon?: (plan: PlanDefinition) => boolean
}[] = [
  { label: 'Credits a month', value: (plan) => plan.monthlyCredits.toLocaleString('en-US') },
  { label: 'Brands', value: (plan) => String(plan.limits.brands) },
  {
    label: 'Team members',
    value: (plan) => String(plan.limits.teamMembers),
    soon: (plan) => !TEAM_INVITES_BUILT && plan.limits.teamMembers > 1,
  },
  { label: 'Campaign builder', value: (plan) => plan.limits.campaignBuilder },
  { label: 'Content Studio & Ad Studio', value: () => true },
  { label: 'Full Brand Kit', value: (plan) => plan.limits.brandKit },
  { label: 'Marketing calendar', value: (plan) => plan.limits.contentCalendar },
  { label: 'AI video plans', value: (plan) => plan.limits.videoGeneration },
  { label: 'Analytics & Insights', value: (plan) => plan.limits.analytics },
  ...(Object.keys(UNBUILT_ROWS) as (keyof typeof UNBUILT_ROWS)[]).map((key) => ({
    label: UNBUILT_ROWS[key],
    value: (plan: PlanDefinition) => plan.limits[key],
    soon: () => UNBUILT.has(key),
  })),
  { label: 'Nexa Deep in the AI Assistant', value: (plan) => (DEEP_MODEL ? canUseModel(DEEP_MODEL, plan.id) : false) },
]

/** Every plan against every capability, read straight from the plan config. */
export function PlanMatrix() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-raised shadow-xs">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead className="bg-ink-50">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium text-ink-600">
              <span className="sr-only">Feature</span>
            </th>
            {PLAN_LIST.map((plan) => (
              <th key={plan.id} scope="col" className="px-4 py-3 text-center font-semibold text-ink-900">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX.map((row) => (
            <tr key={row.label} className="border-t border-ink-100">
              <th scope="row" className="px-5 py-2.5 font-normal text-ink-800">
                {row.label}
              </th>
              {PLAN_LIST.map((plan) => {
                const value = row.value(plan)
                const soon = value !== false && row.soon?.(plan)
                return (
                  <td key={plan.id} className="px-4 py-2.5 text-center tabular-nums text-ink-900">
                    {soon ? (
                      <span className="text-ink-500">
                        {value === true ? '' : `${value} `}
                        <span className="rounded-full bg-ink-100 px-1.5 py-px text-[11px] font-medium text-ink-600">Soon</span>
                      </span>
                    ) : value === true ? (
                      <Check className="mx-auto h-4 w-4 text-brand-600" aria-label="Included" />
                    ) : value === false ? (
                      <Minus className="mx-auto h-4 w-4 text-ink-300" aria-label="Not included" />
                    ) : (
                      value
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
