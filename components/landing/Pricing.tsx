import { Check } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { PRICING } from '@/lib/content/landing'
import { cn } from '@/lib/utils/cn'
import { Section, SectionHeading } from './Section'

export function PricingTable({
  withHeading = true,
  signedIn = false,
}: {
  withHeading?: boolean
  /** Signed-in visitors are sent to the app rather than back to sign-up. */
  signedIn?: boolean
}) {
  return (
    <div className={cn(!withHeading && 'mt-0')}>
      {withHeading && (
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when the work gets harder."
          description="Everything that makes Nexa useful day to day is on the Free plan. Pro adds the most capable model and more room to use it."
        />
      )}

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
        {PRICING.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              'relative flex h-full flex-col rounded-2xl border bg-raised p-8',
              tier.featured
                ? 'border-brand-600 shadow-lg ring-1 ring-brand-600'
                : 'border-ink-200 shadow-xs',
            )}
          >
            {tier.featured && (
              <span className="absolute -top-3 left-8 rounded-full bg-brand-600 px-3 py-1 text-[11.5px] font-semibold text-white">
                Most popular
              </span>
            )}

            <h3 className="text-[15px] font-semibold text-ink-900">{tier.name}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{tier.description}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-[38px] font-semibold tracking-tight text-ink-900">
                {tier.price}
              </span>
              <span className="text-[14px] text-ink-500">{tier.cadence}</span>
            </p>

            <LinkButton
              href={signedIn ? '/chat' : tier.href}
              variant={tier.featured ? 'primary' : 'secondary'}
              size="lg"
              className="mt-6 w-full"
            >
              {signedIn ? 'Open Nexa' : tier.cta}
            </LinkButton>

            <ul className="mt-7 space-y-3 border-t border-ink-200 pt-7">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[14.5px] text-ink-700">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
