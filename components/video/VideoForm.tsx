'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Clapperboard } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import { PLATFORM_LABEL, type Platform } from '@/lib/campaigns/options'
import { DURATIONS, VIDEO_PLATFORMS, VIDEO_TYPES, VIDEO_TYPE_OPTIONS, type VideoType } from '@/lib/video/plan'

export interface VideoFormCampaign {
  id: string
  name: string
  concepts: { id: string; title: string | null; platform: Platform | null }[]
}

export interface VideoFormInitial {
  type: VideoType
  platform: Platform
  durationSeconds: number
  productId: string | null
  campaignId: string | null
  conceptId: string | null
}

export function VideoForm({
  products,
  campaigns,
  initial,
  cost,
  balance,
}: {
  products: { id: string; name: string }[]
  campaigns: VideoFormCampaign[]
  initial: VideoFormInitial
  cost: number
  balance: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [type, setType] = useState(initial.type)
  const [platform, setPlatform] = useState(initial.platform)
  const [duration, setDuration] = useState(initial.durationSeconds)
  const [productId, setProductId] = useState(initial.productId)
  const [campaignId, setCampaignId] = useState(initial.campaignId)
  const [conceptId, setConceptId] = useState(initial.conceptId)
  const [goal, setGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [notes, setNotes] = useState('')

  const campaign = campaigns.find((candidate) => candidate.id === campaignId) ?? null
  const canAfford = balance >= cost

  async function generate() {
    const result = await form.submit<{ id: string }>('/api/videos', {
      type,
      platform,
      durationSeconds: duration,
      productId,
      campaignId,
      conceptId,
      goal,
      audience,
      tone,
      notes,
    })
    if (!result) return
    router.push(`/video/${result.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {form.error && <Alert>{form.error}</Alert>}

      <Card title="What kind of video?">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Video type">
          {VIDEO_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => setType(option)}
              className={cn(
                'rounded-xl p-3 text-left ring-1 ring-inset transition-colors',
                type === option ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-raised ring-ink-200 hover:bg-ink-50',
              )}
            >
              <span className="block text-[14px] font-medium text-ink-900">{VIDEO_TYPE_OPTIONS[option].label}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-600">{VIDEO_TYPE_OPTIONS[option].description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Where, and how long?">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Platform">
          {VIDEO_PLATFORMS.map((option) => (
            <Chip key={option} selected={platform === option} onClick={() => setPlatform(option)}>
              {PLATFORM_LABEL[option]}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Length">
          {DURATIONS.map((seconds) => (
            <Chip key={seconds} selected={duration === seconds} onClick={() => setDuration(seconds)}>
              {seconds}s
            </Chip>
          ))}
        </div>
      </Card>

      <Card title="What is it for?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" hint="Optional.">
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={productId ?? ''} onChange={(event) => setProductId(event.target.value || null)}>
                <option value="">No specific product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Campaign" hint="Optional. The plan follows its strategy.">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={campaignId ?? ''}
                onChange={(event) => {
                  setCampaignId(event.target.value || null)
                  setConceptId(null)
                }}
              >
                <option value="">No campaign</option>
                {campaigns.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {campaign && campaign.concepts.length > 0 && (
            <Field label="From a video concept" error={form.fields.conceptId}>
              {({ id }) => (
                <Select
                  id={id}
                  value={conceptId ?? ''}
                  onChange={(event) => {
                    const next = event.target.value || null
                    setConceptId(next)
                    const concept = campaign.concepts.find((candidate) => candidate.id === next)
                    if (concept?.platform && VIDEO_PLATFORMS.includes(concept.platform)) setPlatform(concept.platform)
                  }}
                >
                  <option value="">None</option>
                  {campaign.concepts.map((concept) => (
                    <option key={concept.id} value={concept.id}>
                      {concept.title ?? 'Untitled concept'}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Goal" error={form.fields.goal}>
            {({ id }) => <Input id={id} maxLength={300} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Drive pre-orders" />}
          </Field>
          <Field label="Audience" error={form.fields.audience}>
            {({ id }) => <Input id={id} maxLength={300} value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="From your Brand Kit if blank" />}
          </Field>
          <Field label="Tone" error={form.fields.tone}>
            {({ id }) => <Input id={id} maxLength={120} value={tone} onChange={(event) => setTone(event.target.value)} placeholder="Calm, warm, a little funny" />}
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Anything else?" hint="Who is on camera, where you can film, what you have to hand." error={form.fields.notes}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Shot on a phone in our studio. The founder is happy to be on camera."
                aria-describedby={describedBy}
              />
            )}
          </Field>
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
              Writing the plan…
            </>
          ) : (
            <>
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              Write video plan
            </>
          )}
        </Button>
      </div>
      {!canAfford && <p className="text-right text-[13px] text-danger-text">Not enough credits.</p>}
    </div>
  )
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
