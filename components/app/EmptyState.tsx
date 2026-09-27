import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * What a section shows before there is anything in it. An empty state states
 * the truth — there is nothing here yet — and offers the one action that
 * changes that.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-300 bg-ink-50/60 px-6 py-14 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-raised text-ink-400 shadow-xs ring-1 ring-ink-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[15.5px] font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-600">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
