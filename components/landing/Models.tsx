import { Check, Gauge, Sparkles, Zap, type LucideIcon } from 'lucide-react'
import { NEXA_MODELS } from '@/lib/ai/models'
import { Section, SectionHeading } from './Section'

const ICONS: Record<string, LucideIcon> = {
  'nexa-swift': Zap,
  'nexa-balanced': Gauge,
  'nexa-deep': Sparkles,
}

/**
 * Reads the model list straight from the registry the server uses, so the site
 * cannot advertise a tier the product does not actually offer.
 */
export function Models() {
  return (
    <Section id="models">
      <SectionHeading
        eyebrow="Models"
        title="Pick how hard Nexa should think"
        description="Three settings, switchable mid-conversation. Most work sits happily on Balanced."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {NEXA_MODELS.map((model) => {
          const Icon = ICONS[model.id] ?? Gauge
          return (
            <div
              key={model.id}
              className="flex flex-col rounded-2xl border border-ink-200 bg-raised p-7 shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                  {model.badge}
                </span>
              </div>

              <h3 className="mt-5 text-[17px] font-semibold text-ink-900">{model.name}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-600">
                {model.description}
              </p>

              <p className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
                <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {model.requiresPlan === 'FREE' ? 'Included on Free' : 'Included with Pro'}
              </p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
