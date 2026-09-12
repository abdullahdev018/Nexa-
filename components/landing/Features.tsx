import {
  Code2,
  FileSearch,
  History,
  MessagesSquare,
  PenLine,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { FEATURES } from '@/lib/content/landing'
import { Section, SectionHeading } from './Section'

// An explicit map rather than a dynamic lookup: this way the bundler only
// includes the six icons actually used.
const ICONS: Record<string, LucideIcon> = {
  MessagesSquare,
  Zap,
  FileSearch,
  History,
  Code2,
  PenLine,
}

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need, and nothing you don't"
        description="Nexa is built around the handful of things people actually do with an assistant all day — and it does each of them properly."
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = ICONS[feature.icon] ?? MessagesSquare
          return (
            <div
              key={feature.title}
              className="group bg-raised p-7 transition-colors hover:bg-brand-50/40"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors group-hover:bg-brand-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[17px] font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{feature.description}</p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
