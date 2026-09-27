import { Check, Clock } from 'lucide-react'
import { ComingSoon } from '@/components/ui/ComingSoon'
import type { Highlight } from '@/lib/billing/plans'
import { cn } from '@/lib/utils/cn'

/** One pricing-card line. Unbuilt features are never ticked. */
export function HighlightLine({ highlight, size = 'md' }: { highlight: Highlight; size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[13.5px]' : 'text-[14px]'
  if (highlight.soon) {
    return (
      <li className={`flex gap-2 ${text} text-ink-600`}>
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
        <span>{highlight.text}</span>
      </li>
    )
  }
  return (
    <li className={`flex gap-2 ${text} text-ink-700`}>
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
      <span>{highlight.text}</span>
    </li>
  )
}

/**
 * A plan's lines: what is included today, then — in its own box, so the two
 * can never be confused — what the plan will include once it is built.
 */
export function PlanHighlights({
  highlights,
  size = 'md',
  className,
}: {
  highlights: Highlight[]
  size?: 'sm' | 'md'
  className?: string
}) {
  const live = highlights.filter((highlight) => !highlight.soon)
  const soon = highlights.filter((highlight) => highlight.soon)

  return (
    <div className={className}>
      <ul className={size === 'sm' ? 'space-y-1.5' : 'space-y-2.5'}>
        {live.map((highlight) => (
          <HighlightLine key={highlight.text} highlight={highlight} size={size} />
        ))}
      </ul>

      {soon.length > 0 && (
        <div
          className={cn(
            'rounded-xl border border-dashed border-amber-300/80 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5',
            size === 'sm' ? 'mt-3 p-2.5' : 'mt-4 p-3',
          )}
        >
          <ComingSoon size="xs" />
          <ul className="mt-2 space-y-1.5">
            {soon.map((highlight) => (
              <HighlightLine key={highlight.text} highlight={highlight} size="sm" />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
