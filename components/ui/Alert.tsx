import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Errors are announced assertively because they follow an action the user just
 * took; successes politely, so they do not interrupt what is being read.
 */
export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'success'
  children: ReactNode
  className?: string
}) {
  const isError = tone === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[14px] leading-relaxed',
        isError
          ? 'border-danger-border bg-danger-surface text-danger-text'
          : 'border-success-border bg-success-surface text-success-text',
        className,
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', isError ? 'text-danger-icon' : 'text-success-icon')}
        aria-hidden="true"
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
