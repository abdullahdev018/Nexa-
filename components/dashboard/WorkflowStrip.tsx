import { BarChart3, Clapperboard, FileText, Lightbulb, Package, Target } from 'lucide-react'

const STEPS = [
  { label: 'Product', icon: Package },
  { label: 'Strategy', icon: Lightbulb },
  { label: 'Content', icon: FileText },
  { label: 'Video', icon: Clapperboard },
  { label: 'Ads', icon: Target },
  { label: 'Analytics', icon: BarChart3 },
]

/** The shape of the product, in one line: one brief becomes a whole campaign. */
export function WorkflowStrip() {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon
        return (
          <li key={step.label} className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-2.5 py-1.5 text-[12.5px] font-medium text-ink-700 ring-1 ring-ink-200">
              <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="px-0.5 text-ink-400">
                →
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
