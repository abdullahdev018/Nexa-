import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/**
 * One number on the dashboard.
 *
 * `hint` is where a count gets its caveat — "0 rendered", "no source
 * connected". A bare number that quietly means something narrower than its
 * label is how a dashboard starts lying.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  hint?: string
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-600">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink-900 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-2 min-h-[1rem] text-[12px] leading-snug text-ink-500">{hint ?? ''}</p>
    </>
  )

  const className =
    'block rounded-xl border border-ink-200 bg-raised p-4 shadow-xs transition-colors'

  if (!href) return <div className={className}>{body}</div>

  return (
    <Link href={href} className={`${className} hover:border-ink-300 hover:bg-ink-50`}>
      {body}
    </Link>
  )
}
