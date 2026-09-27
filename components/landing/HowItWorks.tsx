import { STEPS } from '@/lib/content/landing'
import { LinkButton } from '@/components/ui/Button'
import { Section, SectionHeading } from './Section'

export function HowItWorks({ signedIn }: { signedIn: boolean }) {
  return (
    <Section id="how-it-works" muted>
      <SectionHeading
        eyebrow="How it works"
        title="One brief. Your entire marketing campaign."
        description="No setup to get wrong and nothing to install. Tell Nexa about your brand once, then brief it like you would a marketing team."
      />

      <ol className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative">
            {/* The connector is decoration between cards, so it is hidden from
                assistive technology and dropped entirely when stacked. */}
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[calc(50%+2rem)] right-[-1.5rem] top-6 hidden h-px bg-ink-300 sm:block"
              />
            )}

            <div className="relative flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-ink-200 bg-raised text-[17px] font-semibold text-brand-600 shadow-xs">
                {index + 1}
              </span>
              <h3 className="mt-5 text-[17px] font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex justify-center sm:justify-start">
        <LinkButton href={signedIn ? '/dashboard' : '/signup'} size="lg">
          {signedIn ? 'Open Nexa' : 'Start free'}
        </LinkButton>
      </div>
    </Section>
  )
}
