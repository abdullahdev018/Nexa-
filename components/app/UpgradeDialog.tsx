'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, Crown, Lock, LockOpen, Sparkles, X } from 'lucide-react'
import {
  PLAN_LIST,
  UNBUILT,
  formatPrice,
  getPlan,
  planAllows,
  type PlanDefinition,
  type PlanId,
  type PlanLimits,
} from '@/lib/billing/plans'
import { NAV_ITEMS } from '@/lib/content/navigation'
import { cn } from '@/lib/utils/cn'

/** The switch-on capabilities, in the words a pricing card would use. */
const CAPABILITY_LABEL: Partial<Record<keyof PlanLimits, string>> = {
  brandKit: 'Full Brand Kit',
  contentCalendar: 'Marketing calendar',
  videoGeneration: 'AI video plans',
  analytics: 'Analytics and Nexa Insights',
  competitorResearch: 'Competitor research',
  bulkGeneration: 'Bulk generation',
  whiteLabelReports: 'White-label reports',
  clientWorkspaces: 'Client workspaces',
}

/** The cheapest plan that includes `feature`. */
export function planThatUnlocks(feature: keyof PlanLimits): PlanDefinition | undefined {
  return PLAN_LIST.find((plan) => planAllows(plan.id, feature))
}

/** What moving from `current` to `target` switches on, built features only. */
function newlyUnlocked(current: PlanId, target: PlanId): string[] {
  return (Object.keys(CAPABILITY_LABEL) as (keyof PlanLimits)[])
    .filter((key) => !UNBUILT.has(key) && planAllows(target, key) && !planAllows(current, key))
    .map((key) => CAPABILITY_LABEL[key]!)
}

/**
 * Shown when someone reaches for a feature their plan does not include: which
 * plan unlocks it, what it costs, and what else comes with it. Portalled to
 * the body, because the mobile sidebar drawer is transformed and would trap a
 * fixed-position dialog inside it. Mount it only while open, so the padlock
 * animation starts from shut every time.
 */
export function UpgradeDialog({
  open,
  onClose,
  plan,
  feature,
  previewHref,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  plan: PlanId
  feature: keyof PlanLimits
  /** Where "Take a look first" goes; omitted when already on that page. */
  previewHref?: string
  /** Closes the mobile drawer when a link here navigates away. */
  onNavigate?: () => void
}) {
  const titleId = useId()
  const cta = useRef<HTMLAnchorElement>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    if (!open) return
    cta.current?.focus()
    document.body.style.overflow = 'hidden'
    // The padlock rattles first, then opens.
    const timer = window.setTimeout(() => setUnlocked(true), 850)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  function leave() {
    onClose()
    onNavigate?.()
  }

  const target = planThatUnlocks(feature)
  const item = NAV_ITEMS.find((candidate) => candidate.requires === feature)
  const Icon = item?.icon ?? Sparkles
  const label = item?.label ?? CAPABILITY_LABEL[feature] ?? 'This feature'
  const current = getPlan(plan)
  const unlocks = target ? newlyUnlocked(plan, target.id) : []

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-night-900/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-pop-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-raised shadow-xl ring-1 ring-ink-200 sm:max-w-md sm:rounded-3xl"
      >
        {/* Header: the feature's icon behind a padlock that opens. */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-6 pb-9 pt-8 text-center">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-indigo-300/25 blur-2xl" />
            {[
              'left-[14%] top-[22%] h-3 w-3',
              'left-[26%] bottom-[18%] h-2 w-2 [animation-delay:0.8s]',
              'right-[16%] top-[30%] h-3.5 w-3.5 [animation-delay:0.4s]',
              'right-[28%] bottom-[22%] h-2 w-2 [animation-delay:1.3s]',
            ].map((position) => (
              <Sparkles key={position} className={cn('animate-float absolute text-white/80', position)} />
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="relative mx-auto h-20 w-20">
            <div className="animate-glow absolute -inset-3 rounded-[28px] bg-white/25 blur-md" aria-hidden="true" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 shadow-lg">
              <Icon className="h-9 w-9 text-brand-600" aria-hidden="true" />
            </div>
            <div
              className={cn(
                'absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-4 ring-white/30 transition-colors duration-300',
                unlocked ? 'bg-emerald-500' : 'bg-amber-400',
              )}
            >
              {unlocked && (
                <span className="animate-burst absolute inset-0 rounded-full bg-emerald-300" aria-hidden="true" />
              )}
              {unlocked ? (
                <LockOpen key="open" className="animate-unlock-pop relative h-4 w-4 text-white" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Lock key="shut" className="animate-lock-shake h-4 w-4 text-amber-950" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-6">
          <div className="animate-rise text-center [animation-delay:0.1s]">
            {target && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                <Crown className="h-3 w-3" aria-hidden="true" />
                {target.name} feature
              </span>
            )}
            <h2 id={titleId} className="mt-3 text-[20px] font-semibold tracking-tight text-ink-900">
              Unlock {label}
              {target ? ` with ${target.name}` : ''}
            </h2>
            {item?.description && <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{item.description}</p>}
            <p className="mt-2 text-[13px] text-ink-500">You&apos;re on the {current.name} plan.</p>
          </div>

          {target && (
            <div className="animate-rise mt-5 rounded-2xl bg-gradient-to-br from-brand-50 via-raised to-indigo-50 p-4 ring-2 ring-brand-300 [animation-delay:0.2s] dark:to-indigo-500/10">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold text-ink-900">
                    {target.name}
                    {target.mostPopular && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[10.5px] font-medium uppercase tracking-wide text-brand-700">
                        Popular
                      </span>
                    )}
                  </p>
                  <p className="text-[22px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">
                    {formatPrice(target.monthlyPriceCents)}
                    <span className="text-[12.5px] font-normal text-ink-500"> / month</span>
                  </p>
                </div>

                <ul className="mt-3.5 space-y-2">
                  {[
                    `${target.monthlyCredits.toLocaleString('en-US')} credits a month (you have ${current.monthlyCredits.toLocaleString('en-US')})`,
                    ...unlocks,
                  ].map((line, index) => {
                    const isThis = line === CAPABILITY_LABEL[feature]
                    return (
                      <li
                        key={line}
                        style={{ animationDelay: `${0.3 + index * 0.07}s` }}
                        className={cn(
                          'animate-rise flex items-start gap-2 text-[13.5px]',
                          isThis ? 'font-medium text-ink-900' : 'text-ink-700',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                            isThis ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600',
                          )}
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {line}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          <div className="animate-rise mt-6 flex flex-col gap-2 [animation-delay:0.45s]">
            <Link
              ref={cta}
              href={target ? `/billing?plan=${target.id}#plans-heading` : '/billing#plans-heading'}
              onClick={leave}
              className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-[15px] font-medium text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              <span
                className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                aria-hidden="true"
              />
              <Crown className="h-4 w-4" aria-hidden="true" />
              {target ? `Upgrade to ${target.name}` : 'See plans'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {previewHref ? (
              <Link
                href={previewHref}
                onClick={leave}
                className="inline-flex h-10 items-center justify-center rounded-xl text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                Take a look first
              </Link>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-xl text-[13.5px] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                Maybe later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
