'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { PlanHighlights } from './HighlightLine'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { PLAN_LIST, formatPrice, type PlanId } from '@/lib/billing/plans'

/**
 * The plans side by side. With no payment provider there is nothing to buy,
 * so no card has a buy button — only the development switch, when it is on,
 * and it says what it is.
 */
export function PlanCards({
  current,
  paymentsExplanation,
  devSwitch,
  canAdminister,
}: {
  current: PlanId
  paymentsExplanation: string
  devSwitch: boolean
  canAdminister: boolean
}) {
  const router = useRouter()
  const form = useApiForm()
  const [yearly, setYearly] = useState(false)
  const [pending, setPending] = useState<PlanId | null>(null)
  // Set by the upgrade dialog, so the plan it recommended stands out here.
  const suggested = useSearchParams().get('plan')

  async function switchTo(plan: PlanId) {
    setPending(plan)
    const result = await form.submit('/api/billing/dev-plan', { plan })
    form.stop()
    setPending(null)
    if (result) router.refresh()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-ink-100 p-1" role="group" aria-label="Billing period">
          {[false, true].map((option) => (
            <button
              key={String(option)}
              type="button"
              aria-pressed={yearly === option}
              onClick={() => setYearly(option)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                yearly === option ? 'bg-raised text-ink-900 shadow-xs' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {option ? 'Yearly · 2 months free' : 'Monthly'}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-500">{paymentsExplanation}</p>
      </div>

      {form.error && <Alert className="mb-4">{form.error}</Alert>}

      {devSwitch && (
        <div role="note" className="mb-4 flex items-start gap-2.5 rounded-xl border-2 border-dashed border-warn-text/40 bg-ink-50 p-3 text-[13px] text-ink-700">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warn-text" aria-hidden="true" />
          <p>
            <span className="font-semibold text-ink-900">Development switch is on.</span> It changes this workspace&apos;s
            plan without payment so plan limits can be tested. It is never available in production, and the credit
            history records each switch as not a purchase.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => {
          const isCurrent = plan.id === current
          const isSuggested = plan.id === suggested && !isCurrent
          const price = yearly ? plan.yearlyPriceCents : plan.monthlyPriceCents
          return (
            <section
              key={plan.id}
              aria-label={`${plan.name} plan`}
              className={cn(
                'flex flex-col rounded-2xl border bg-raised p-5 shadow-xs',
                isCurrent ? 'border-brand-400 ring-1 ring-brand-200' : 'border-ink-200',
                isSuggested && 'animate-pop-in border-brand-500 shadow-lg ring-4 ring-brand-200',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[16px] font-semibold text-ink-900">{plan.name}</h3>
                {isSuggested ? (
                  <span className="rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">Unlocks it</span>
                ) : isCurrent ? (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">Current</span>
                ) : plan.mostPopular ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-700">Popular</span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-ink-600">{plan.tagline}</p>
              <p className="mt-4 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">
                {formatPrice(price)}
                <span className="text-[13px] font-normal text-ink-500"> / {yearly ? 'year' : 'month'}</span>
              </p>
              <PlanHighlights highlights={plan.highlights} size="sm" className="mt-4 flex-1" />
              {devSwitch && canAdminister && !isCurrent && (
                <Button size="sm" variant="secondary" className="mt-5" onClick={() => switchTo(plan.id)} disabled={form.submitting}>
                  {pending === plan.id ? <Spinner label="Switching" /> : `Switch to ${plan.name} (dev)`}
                </Button>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
