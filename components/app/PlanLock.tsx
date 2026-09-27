'use client'

import { useCallback, useState } from 'react'
import { Crown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getPlan, planAllows, type PlanId, type PlanLimits } from '@/lib/billing/plans'
import { UpgradeDialog, planThatUnlocks } from './UpgradeDialog'

/**
 * Says a built feature is not on the workspace's plan, and which plan has it.
 * Renders nothing when the plan includes it.
 */
export function PlanLock({
  plan,
  feature,
  what,
}: {
  plan: PlanId
  feature: keyof PlanLimits
  /** The feature in the user's words, e.g. "AI video planning". */
  what: string
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  if (planAllows(plan, feature)) return null
  const needed = planThatUnlocks(feature)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
      <p className="inline-flex items-center gap-2 text-[14px] text-ink-700">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
        {what} is included from {needed?.name ?? 'a paid plan'}. You are on {getPlan(plan).name}.
      </p>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
        Unlock with {needed?.name ?? 'a paid plan'}
      </Button>
      {open && <UpgradeDialog open onClose={close} plan={plan} feature={feature} />}
    </div>
  )
}
