import { ShieldCheck } from 'lucide-react'
import { HONESTY } from '@/lib/content/landing'
import { Section, SectionHeading } from './Section'

/** What Nexa does not do, said before anyone has to ask. */
export function Honesty() {
  return (
    <Section id="honest">
      <SectionHeading
        eyebrow="No pretending"
        title="It tells you what it did — and what it didn't"
        description="Marketing tools love to blur the line between planned and done. Nexa keeps it sharp."
      />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HONESTY.map((item) => (
          <li key={item.title} className="rounded-2xl border border-ink-200 bg-raised p-6 shadow-xs">
            <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <h3 className="mt-4 text-[16px] font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">{item.description}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
