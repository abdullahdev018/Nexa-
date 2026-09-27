'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown, Gauge, Lock, Sparkles, Zap, type LucideIcon } from 'lucide-react'
import { NEXA_MODELS, canUseModel, getModel } from '@/lib/ai/models'
import { useDismiss } from '@/lib/hooks/useDismiss'
import { cn } from '@/lib/utils/cn'
import type { PlanId } from '@/lib/billing/plans'

const ICONS: Record<string, LucideIcon> = {
  'nexa-swift': Zap,
  'nexa-balanced': Gauge,
  'nexa-deep': Sparkles,
}

export function ModelPicker({
  value,
  onChange,
  plan,
  disabled,
}: {
  value: string
  onChange: (modelId: string) => void
  plan: PlanId
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useDismiss(container, open, () => setOpen(false))

  const active = getModel(value)
  const ActiveIcon = ICONS[active.id] ?? Gauge

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ActiveIcon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
        {active.name}
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-40 mb-2 w-[19rem] overflow-hidden rounded-xl border border-ink-200 bg-raised p-1.5 shadow-lg"
        >
          {NEXA_MODELS.map((model) => {
            const Icon = ICONS[model.id] ?? Gauge
            const allowed = canUseModel(model, plan)
            const selected = model.id === value

            return (
              <button
                key={model.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={!allowed}
                onClick={() => {
                  onChange(model.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                  allowed ? 'hover:bg-ink-50' : 'cursor-not-allowed opacity-60',
                  selected && 'bg-brand-50',
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    selected ? 'text-brand-600' : 'text-ink-400',
                  )}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-ink-900">{model.name}</span>
                    {!allowed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-night-900 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                        Pro
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">
                    {model.description}
                  </span>
                </span>

                {selected && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
