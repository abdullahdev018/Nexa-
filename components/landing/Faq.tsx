import { ChevronDown } from 'lucide-react'
import { FAQ } from '@/lib/content/landing'
import { Section, SectionHeading } from './Section'

/**
 * Native <details> rather than a scripted accordion: it is keyboard accessible
 * and findable with in-page search for free, and needs no client JavaScript.
 */
export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />

      <div className="mx-auto mt-14 max-w-3xl divide-y divide-ink-200 border-y border-ink-200">
        {FAQ.map((item) => (
          <details key={item.question} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[16.5px] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                className="h-5 w-5 shrink-0 text-ink-400 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-6 pr-10 text-[15.5px] leading-relaxed text-ink-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
