'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Target } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { GOALS, GOAL_OPTIONS, type CampaignGoal } from '@/lib/campaigns/options'
import { AD_PLATFORMS, AD_SPECS, MAX_AD_VARIATIONS, type AdPlatform } from '@/lib/ads/plan'

export interface AdFormInitial {
  platform: AdPlatform
  objective: CampaignGoal
  productId: string | null
  campaignId: string | null
}

export function AdForm({
  products,
  campaigns,
  initial,
  cost,
  balance,
}: {
  products: { id: string; name: string }[]
  campaigns: { id: string; name: string }[]
  initial: AdFormInitial
  cost: number
  balance: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [platform, setPlatform] = useState(initial.platform)
  const [objective, setObjective] = useState(initial.objective)
  const [variations, setVariations] = useState(3)
  const [productId, setProductId] = useState(initial.productId)
  const [campaignId, setCampaignId] = useState(initial.campaignId)
  const [offer, setOffer] = useState('')
  const [audience, setAudience] = useState('')
  const [notes, setNotes] = useState('')
  const canAfford = balance >= cost

  async function generate() {
    const result = await form.submit<{ ids: string[] }>('/api/ads', {
      platform,
      objective,
      variations,
      productId,
      campaignId,
      offer,
      audience,
      notes,
    })
    if (!result) return
    router.push(`/ads/${result.ids[0]}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {form.error && <Alert>{form.error}</Alert>}

      <Card title="Platform">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Platform">
          {AD_PLATFORMS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={platform === option}
              onClick={() => setPlatform(option)}
              className={cn(
                'rounded-xl p-3.5 text-left ring-1 ring-inset transition-colors',
                platform === option ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-raised ring-ink-200 hover:bg-ink-50',
              )}
            >
              <span className="block text-[14.5px] font-semibold text-ink-900">{AD_SPECS[option].label}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-600">{AD_SPECS[option].format}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-500">{limitsLine(platform)}</p>
      </Card>

      <Card title="Objective">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Objective">
          {GOALS.map((goal) => (
            <Chip key={goal} selected={objective === goal} onClick={() => setObjective(goal)}>
              {GOAL_OPTIONS[goal].label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card title="What are you advertising?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" hint="Optional.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={productId ?? ''} onChange={(e) => setProductId(e.target.value || null)}>
                <option value="">No specific product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Campaign" hint="Optional. The ads follow its strategy.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={campaignId ?? ''} onChange={(e) => setCampaignId(e.target.value || null)}>
                <option value="">No campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Offer" hint="Only what is real — Nexa will not invent one." error={form.fields.offer}>
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} maxLength={300} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="15% off your first order until Sunday" />
            )}
          </Field>
          <Field label="Audience" error={form.fields.audience}>
            {({ id }) => (
              <Input id={id} maxLength={300} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="From your Brand Kit if blank" />
            )}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Anything else?" error={form.fields.notes}>
            {({ id }) => (
              <Textarea id={id} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Keywords to include, claims to avoid, the landing page it points to." />
            )}
          </Field>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-ink-700">Variations</p>
          <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Variations">
            {Array.from({ length: MAX_AD_VARIATIONS }, (_, i) => i + 1).map((count) => (
              <Chip key={count} selected={variations === count} onClick={() => setVariations(count)}>
                {count}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-[13px] text-ink-500">
          {cost} credits, charged only if it succeeds · {balance.toLocaleString()} left
        </span>
        <Button size="lg" onClick={generate} disabled={form.submitting || !canAfford}>
          {form.submitting ? (
            <>
              <Spinner label="Writing" />
              Writing ads…
            </>
          ) : (
            <>
              <Target className="h-4 w-4" aria-hidden="true" />
              Write ads
            </>
          )}
        </Button>
      </div>
      {!canAfford && <p className="text-right text-[13px] text-danger-text">Not enough credits.</p>}
    </div>
  )
}

function limitsLine(platform: AdPlatform): string {
  const spec = AD_SPECS[platform]
  const parts = [
    spec.primaryText && `primary text ${spec.primaryText.recommended ?? spec.primaryText.max} characters`,
    spec.headlines && `${spec.headlines.min === spec.headlines.max ? spec.headlines.max : `up to ${spec.headlines.max}`} headlines of ${spec.headlines.chars}`,
    spec.descriptions && spec.descriptions.max > 0 && `descriptions of ${spec.descriptions.chars}`,
  ].filter(Boolean)
  return `Written to ${spec.label}'s limits: ${parts.join(', ')}.`
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs sm:p-6">
      <h2 className="mb-3 text-[15px] font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors',
        selected ? 'bg-ink-900 text-white ring-ink-900' : 'bg-raised text-ink-700 ring-ink-300 hover:bg-ink-50',
      )}
    >
      {children}
    </button>
  )
}
