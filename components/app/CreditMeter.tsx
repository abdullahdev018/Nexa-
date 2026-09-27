import Link from 'next/link'
import { Coins } from 'lucide-react'
import type { CreditSummary } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

/**
 * Credits remaining in the current period.
 *
 * The bar shows what is LEFT rather than what has been used, because that is
 * the question someone actually has when they glance at it.
 */
export function CreditMeter({ credits, onNavigate }: { credits: CreditSummary; onNavigate?: () => void }) {
  const allowance = Math.max(credits.monthlyAllowance, 1)
  const remaining = Math.max(0, Math.min(credits.balance, allowance))
  const percent = Math.round((remaining / allowance) * 100)

  const low = percent <= 15
  const renews = new Date(credits.periodEnd)

  return (
    <div className="rounded-xl bg-raised p-3 ring-1 ring-ink-200">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
          <Coins className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          <Link href="/billing" onClick={onNavigate} className="hover:text-ink-900 hover:underline">
            Credits
          </Link>
        </span>
        <span className={cn('text-[12px] font-semibold tabular-nums', low ? 'text-warn-text' : 'text-ink-800')}>
          {credits.balance.toLocaleString()}
          <span className="font-normal text-ink-500"> / {credits.monthlyAllowance.toLocaleString()}</span>
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={credits.monthlyAllowance}
        aria-label="Credits remaining this period"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', low ? 'bg-warn-text' : 'bg-brand-600')}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-[11.5px] leading-snug text-ink-500">
        {credits.balance === 0 ? (
          <>
            Out of credits.{' '}
            <Link href="/billing" onClick={onNavigate} className="font-medium text-brand-600 hover:underline">
              See plans
            </Link>{' '}
            or wait for{' '}
          </>
        ) : (
          'Renews '
        )}
        {renews.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
    </div>
  )
}
