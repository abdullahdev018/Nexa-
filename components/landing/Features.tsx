import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  FileText,
  Megaphone,
  Palette,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { PLAN_LIST, planAllows } from '@/lib/billing/plans'
import { FEATURES } from '@/lib/content/landing'
import { Section, SectionHeading } from './Section'

// An explicit map rather than a dynamic lookup: the bundler includes only the
// icons actually used.
const ICONS: Record<string, LucideIcon> = {
  Megaphone,
  Palette,
  FileText,
  Clapperboard,
  Target,
  CalendarDays,
  BarChart3,
  Sparkles,
}

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Features"
        title="The whole team, in one workspace"
        description="Strategist, copywriter, video planner, ad writer and scheduler — working from the same brief, in the same voice."
      />

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = ICONS[feature.icon] ?? Sparkles
          // Named from the plan config, so the badge can never promise a plan
          // that does not include the feature.
          const from = feature.requires ? PLAN_LIST.find((plan) => planAllows(plan.id, feature.requires!)) : null
          return (
            <div key={feature.title} className="group bg-raised p-6 transition-colors hover:bg-brand-50/40">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors group-hover:bg-brand-100">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {from && from.id !== 'FREE' && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">From {from.name}</span>
                )}
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">{feature.description}</p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
