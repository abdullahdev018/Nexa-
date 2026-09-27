import { ArrowRight, FileText } from 'lucide-react'
import { EXAMPLE_CAMPAIGN } from '@/lib/content/landing'

/**
 * A still picture of what one brief turns into. It is labelled "Example" on
 * the card itself: an illustration of the kind of output Nexa writes, not a
 * customer and not a result. Decorative for assistive technology, which gets
 * the same point from the heading above it.
 */
export function CampaignPreview() {
  const { brief, angle, hooks, pieces } = EXAMPLE_CAMPAIGN

  return (
    <div aria-hidden="true" className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-ink-200 bg-raised shadow-xl">
      <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-300" />
        </div>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11.5px] font-medium text-ink-500 ring-1 ring-ink-200">
          Example — the kind of campaign Nexa writes
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[16rem_auto_1fr]">
        <div className="p-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-500">The brief</p>
          <dl className="mt-3 space-y-2.5 text-[13.5px]">
            {Object.entries({ Product: brief.product, Goal: brief.goal, Platforms: brief.platforms, Style: brief.style }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] text-ink-500">{label}</dt>
                <dd className="font-medium text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hidden items-center border-x border-ink-100 px-3 md:flex">
          <ArrowRight className="h-5 w-5 text-brand-500" />
        </div>

        <div className="border-t border-ink-100 p-5 md:border-t-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-500">The campaign</p>
          <div className="mt-3 rounded-xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
            <p className="text-[12px] font-medium text-brand-700">Main angle</p>
            <p className="mt-0.5 text-[14px] text-ink-900">{angle}</p>
          </div>
          <p className="mt-4 text-[12px] font-medium text-ink-500">Hooks</p>
          <ul className="mt-1.5 space-y-1.5">
            {hooks.map((hook) => (
              <li key={hook} className="rounded-lg bg-ink-50 px-3 py-2 text-[13.5px] text-ink-800 ring-1 ring-ink-200">
                &ldquo;{hook}&rdquo;
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pieces.map((piece) => (
              <div key={piece.label} className="rounded-lg p-2.5 ring-1 ring-ink-200">
                <p className="text-[18px] font-semibold tabular-nums text-ink-900">{piece.count}</p>
                <p className="text-[11.5px] text-ink-500">{piece.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <FileText className="h-3.5 w-3.5" />
            Every piece can be edited, rewritten, or turned into a finished post, video plan or ad.
          </p>
        </div>
      </div>
    </div>
  )
}
