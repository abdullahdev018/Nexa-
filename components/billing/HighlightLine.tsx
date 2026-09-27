import { Check, Clock } from 'lucide-react'
import type { Highlight } from '@/lib/billing/plans'

/** One pricing-card line. Unbuilt features say "Soon" and are never ticked. */
export function HighlightLine({ highlight, size = 'md' }: { highlight: Highlight; size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[13.5px]' : 'text-[14px]'
  if (highlight.soon) {
    return (
      <li className={`flex gap-2 ${text} text-ink-500`}>
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        <span>
          {highlight.text}{' '}
          <span className="rounded-full bg-ink-100 px-1.5 py-px text-[11px] font-medium text-ink-600">Soon</span>
        </span>
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
