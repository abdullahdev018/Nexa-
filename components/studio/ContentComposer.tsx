'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import {
  FORMAT_LABEL,
  PLATFORMS,
  PLATFORM_LABEL,
  type ContentFormat,
  type Platform,
} from '@/lib/campaigns/options'
import { FORMAT_HINT, MAX_VARIATIONS, PLATFORM_FORMATS, isValidCombination } from '@/lib/studio/options'

export interface ComposerIdea {
  id: string
  title: string | null
  body: string
  platform: Platform | null
  format: ContentFormat | null
}

export interface ComposerCampaign {
  id: string
  name: string
  platforms: Platform[]
  ideas: ComposerIdea[]
}

export interface ComposerInitial {
  platform: Platform
  format: ContentFormat
  topic: string
  campaignId: string | null
  ideaId: string | null
}

function ideaTopic(idea: ComposerIdea): string {
  return [idea.title, idea.body].filter(Boolean).join(': ').slice(0, 1000)
}

/**
 * One form, one generation. Picking a campaign's content idea fills in the
 * topic, platform and format from it, and the campaign's brief and strategy
 * travel with the request so the piece fits the campaign.
 */
export function ContentComposer({
  campaigns,
  brands,
  initial,
  cost,
  balance,
}: {
  campaigns: ComposerCampaign[]
  brands: { id: string; name: string; isDefault: boolean }[]
  initial: ComposerInitial
  cost: number
  balance: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [platform, setPlatform] = useState(initial.platform)
  const [format, setFormat] = useState(initial.format)
  const [topic, setTopic] = useState(initial.topic)
  const [instructions, setInstructions] = useState('')
  const [variations, setVariations] = useState(1)
  const [campaignId, setCampaignId] = useState(initial.campaignId)
  const [ideaId, setIdeaId] = useState(initial.ideaId)
  const [brandId, setBrandId] = useState<string | null>(null)

  const campaign = campaigns.find((candidate) => candidate.id === campaignId) ?? null
  const canAfford = balance >= cost

  function choosePlatform(next: Platform) {
    setPlatform(next)
    // Keep the format if the new platform has it; otherwise its first one.
    if (!isValidCombination(next, format)) setFormat(PLATFORM_FORMATS[next][0])
    form.clearField('format')
  }

  function chooseIdea(id: string | null) {
    setIdeaId(id)
    const idea = campaign?.ideas.find((candidate) => candidate.id === id)
    if (!idea) return
    setTopic(ideaTopic(idea))
    const nextPlatform = idea.platform ?? platform
    setPlatform(nextPlatform)
    setFormat(idea.format && isValidCombination(nextPlatform, idea.format) ? idea.format : PLATFORM_FORMATS[nextPlatform][0])
  }

  async function generate() {
    const result = await form.submit<{ ids: string[] }>('/api/content/generate', {
      platform,
      format,
      topic,
      instructions,
      variations,
      campaignId,
      ideaId,
      brandId: campaignId ? null : brandId,
    })
    if (!result) return
    router.push(`/content/${result.ids[0]}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {form.error && <Alert>{form.error}</Alert>}

      <section className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs sm:p-6">
        <p className="text-sm font-medium text-ink-700">Platform</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Platform">
          {PLATFORMS.map((option) => (
            <Chip key={option} selected={platform === option} onClick={() => choosePlatform(option)}>
              {PLATFORM_LABEL[option]}
            </Chip>
          ))}
        </div>

        <p className="mt-5 text-sm font-medium text-ink-700">Format</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Format">
          {PLATFORM_FORMATS[platform].map((option) => (
            <Chip key={option} selected={format === option} onClick={() => setFormat(option)}>
              {FORMAT_LABEL[option]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-500">{FORMAT_HINT[format]}</p>
        {form.fields.format && <p className="mt-1 text-[13px] text-danger-icon">{form.fields.format}</p>}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign" hint="Optional. The piece follows the campaign's brief and strategy.">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={campaignId ?? ''}
                onChange={(event) => {
                  setCampaignId(event.target.value || null)
                  setIdeaId(null)
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

          {campaign && campaign.ideas.length > 0 ? (
            <Field label="From a content idea" error={form.fields.ideaId}>
              {({ id }) => (
                <Select id={id} value={ideaId ?? ''} onChange={(event) => chooseIdea(event.target.value || null)}>
                  <option value="">None — write my own topic</option>
                  {campaign.ideas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title ?? idea.body.slice(0, 60)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : !campaign && brands.length > 1 ? (
            <Field label="Brand">
              {({ id }) => (
                <Select id={id} value={brandId ?? ''} onChange={(event) => setBrandId(event.target.value || null)}>
                  <option value="">Default brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>

        {brands.length === 0 && (
          <p className="mt-4 text-[13px] text-ink-500">
            No brand set up, so Nexa writes from the topic alone.{' '}
            <Link href="/brand/new" className="font-medium text-brand-600 hover:underline">
              Set up your brand
            </Link>{' '}
            for copy in your voice.
          </p>
        )}

        <div className="mt-5">
          <Field label="What is it about?" error={form.fields.topic}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                maxLength={1000}
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value)
                  form.clearField('topic')
                }}
                placeholder="Why soy wax burns cleaner than paraffin — and why it matters in a small flat."
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Anything else?" hint="Optional: an offer, a date, something to mention or avoid." error={form.fields.instructions}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                maxLength={1000}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Mention free shipping until Friday."
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-ink-700">Variations</p>
          <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Variations">
            {Array.from({ length: MAX_VARIATIONS }, (_, i) => i + 1).map((count) => (
              <Chip key={count} selected={variations === count} onClick={() => setVariations(count)}>
                {count}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-[13px] text-ink-500">
          {cost} credits, charged only if it succeeds · {balance.toLocaleString()} left
        </span>
        <Button size="lg" onClick={generate} disabled={form.submitting || !canAfford || topic.trim().length < 3}>
          {form.submitting ? (
            <>
              <Spinner label="Writing" />
              Writing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generate
            </>
          )}
        </Button>
      </div>
      {!canAfford && (
        <p className="text-right text-[13px] text-danger-text">
          Not enough credits. Credits renew at the start of the next period.
        </p>
      )}
    </div>
  )
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
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
