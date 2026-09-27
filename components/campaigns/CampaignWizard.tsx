'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button, LinkButton } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'
import {
  CUSTOMER_TYPES,
  GOALS,
  GOAL_OPTIONS,
  PLATFORMS,
  PLATFORM_LABEL,
  STYLES,
  STYLE_OPTIONS,
} from '@/lib/campaigns/options'
import type { WizardValues } from '@/lib/campaigns/wizard'

export interface WizardBrand {
  id: string
  name: string
  isDefault: boolean
}

export interface WizardProduct {
  id: string
  name: string
  brandId: string | null
  category: string | null
}

const STEPS = ['Product', 'Goal', 'Audience', 'Platforms', 'Style', 'Review'] as const

/** Which step a server field error belongs to, so Review can link back to it. */
const FIELD_STEP: Record<string, number> = {
  productId: 0,
  brandId: 0,
  product: 0,
  goal: 1,
  audienceAgeRange: 2,
  audienceLocation: 2,
  audienceInterests: 2,
  audienceCustomerType: 2,
  audiencePainPoints: 2,
  platforms: 3,
  style: 4,
  name: 5,
}

/**
 * The campaign brief, one decision per step.
 *
 * Creating saves a draft and opens the campaign, which starts generating
 * there — so the long wait happens on the page that will show the result, and
 * survives a refresh. Editing (with `campaignId`) replaces the brief and never
 * regenerates on its own: that costs credits, so it is always the user's call.
 */
export function CampaignWizard({
  brands,
  products,
  initial,
  campaignId,
  cost,
  balance,
}: {
  brands: WizardBrand[]
  products: WizardProduct[]
  initial: WizardValues
  campaignId?: string
  cost: number
  balance: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState(initial)
  const [interestDraft, setInterestDraft] = useState('')

  function set<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    form.clearField(key)
  }

  const brandProducts = products.filter(
    (product) => !values.brandId || product.brandId === values.brandId || product.brandId === null,
  )
  const productName =
    values.productId === 'new'
      ? values.product.name.trim()
      : products.find((product) => product.id === values.productId)?.name ?? ''

  /** Why the current step cannot be left yet, or null when it can. */
  function blocker(index: number): string | null {
    if (index === 0 && !productName) return 'Pick a product or describe a new one.'
    if (index === 1 && !values.goal) return 'Choose a goal.'
    if (index === 3 && values.platforms.length === 0) return 'Choose at least one platform.'
    if (index === 4 && !values.style) return 'Choose a style.'
    return null
  }
  const currentBlocker = blocker(step)

  function addInterest() {
    const value = interestDraft.trim().slice(0, 40)
    if (!value || values.audienceInterests.includes(value) || values.audienceInterests.length >= 12) {
      setInterestDraft('')
      return
    }
    set('audienceInterests', [...values.audienceInterests, value])
    setInterestDraft('')
  }

  function payload() {
    return {
      name: values.name,
      brandId: values.brandId,
      productId: values.productId === 'new' ? null : values.productId,
      product: values.productId === 'new' ? values.product : null,
      goal: values.goal,
      style: values.style,
      platforms: values.platforms,
      audienceAgeRange: values.audienceAgeRange,
      audienceLocation: values.audienceLocation,
      audienceInterests: values.audienceInterests,
      audienceCustomerType: values.audienceCustomerType,
      audiencePainPoints: values.audiencePainPoints,
    }
  }

  async function submit(generate: boolean) {
    const result = campaignId
      ? await form.submit<{ campaign: { id: string } }>(`/api/campaigns/${campaignId}`, payload(), 'PUT')
      : await form.submit<{ campaign: { id: string } }>('/api/campaigns', payload())

    if (!result) return
    router.push(`/campaigns/${result.campaign.id}${generate ? '?generate=1' : ''}`)
    router.refresh()
  }

  const canAfford = balance >= cost

  return (
    <div>
      <ol className="mb-8 flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Steps">
        {STEPS.map((label, index) => {
          const done = index < step
          const current = index === step
          // A step can be jumped back to, or forward to once everything before it is valid.
          const reachable = index <= step || STEPS.slice(0, index).every((_, i) => !blocker(i))
          return (
            <li key={label} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => reachable && setStep(index)}
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                  current && 'bg-ink-900 text-white',
                  !current && done && 'text-ink-800 hover:bg-ink-100',
                  !current && !done && 'text-ink-500 hover:bg-ink-100 disabled:hover:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                    current ? 'bg-white/20' : done ? 'bg-brand-600 text-white' : 'bg-ink-200',
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : index + 1}
                </span>
                {label}
              </button>
              {index < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-ink-300" />}
            </li>
          )
        })}
      </ol>

      {form.error && <Alert className="mb-6">{form.error}</Alert>}

      <div className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs sm:p-7">
        {step === 0 && (
          <StepFrame title="What are you promoting?" hint="Pick a product from your Brand Kit, or describe a new one.">
            {brands.length > 1 && (
              <div className="mb-5 max-w-xs">
                <Field label="Brand">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={values.brandId ?? ''}
                      onChange={(event) => {
                        set('brandId', event.target.value || null)
                        set('productId', 'new')
                      }}
                    >
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                          {brand.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )}
            {brands.length === 0 && (
              <p className="mb-5 rounded-lg bg-ink-50 p-3 text-[13.5px] text-ink-600 ring-1 ring-ink-200">
                No brand set up yet, so Nexa will write from the brief alone.{' '}
                <Link href="/brand/new" className="font-medium text-brand-600 hover:underline">
                  Set up your brand
                </Link>{' '}
                for copy that sounds like you.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {brandProducts.map((product) => (
                <ChoiceCard
                  key={product.id}
                  selected={values.productId === product.id}
                  onSelect={() => set('productId', product.id)}
                  title={product.name}
                  description={product.category ?? undefined}
                />
              ))}
              <ChoiceCard
                selected={values.productId === 'new'}
                onSelect={() => set('productId', 'new')}
                title="A new product"
                description="Describe it here. It is saved to your Brand Kit."
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              />
            </div>

            {values.productId === 'new' && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Product name" error={form.fields['product.name']}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      value={values.product.name}
                      maxLength={120}
                      onChange={(event) => set('product', { ...values.product, name: event.target.value })}
                      placeholder="Fig & Cedar Candle"
                      aria-describedby={describedBy}
                      invalid={invalid}
                    />
                  )}
                </Field>
                <Field label="Category" error={form.fields['product.category']}>
                  {({ id }) => (
                    <Input
                      id={id}
                      value={values.product.category}
                      maxLength={80}
                      onChange={(event) => set('product', { ...values.product, category: event.target.value })}
                      placeholder="Home fragrance"
                    />
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="Description"
                    hint="What it is, who it is for, what makes it different."
                    error={form.fields['product.description']}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Textarea
                        id={id}
                        rows={3}
                        maxLength={2000}
                        value={values.product.description}
                        onChange={(event) =>
                          set('product', { ...values.product, description: event.target.value })
                        }
                        aria-describedby={describedBy}
                        invalid={invalid}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Price" error={form.fields['product.price']}>
                  {({ id }) => (
                    <Input
                      id={id}
                      value={values.product.price}
                      maxLength={40}
                      onChange={(event) => set('product', { ...values.product, price: event.target.value })}
                      placeholder="$28"
                    />
                  )}
                </Field>
              </div>
            )}
          </StepFrame>
        )}

        {step === 1 && (
          <StepFrame title="What should this campaign achieve?">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GOALS.map((goal) => (
                <ChoiceCard
                  key={goal}
                  selected={values.goal === goal}
                  onSelect={() => set('goal', goal)}
                  title={GOAL_OPTIONS[goal].label}
                  description={GOAL_OPTIONS[goal].description}
                />
              ))}
            </div>
          </StepFrame>
        )}

        {step === 2 && (
          <StepFrame
            title="Who is it for?"
            hint="All optional. Anything left blank falls back to the audience in your Brand Kit."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Age range" error={form.fields.audienceAgeRange}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={values.audienceAgeRange}
                    maxLength={40}
                    onChange={(event) => set('audienceAgeRange', event.target.value)}
                    placeholder="25–45"
                  />
                )}
              </Field>
              <Field label="Location" error={form.fields.audienceLocation}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={values.audienceLocation}
                    maxLength={120}
                    onChange={(event) => set('audienceLocation', event.target.value)}
                    placeholder="UK and Ireland"
                  />
                )}
              </Field>
              <Field label="Customer type" error={form.fields.audienceCustomerType}>
                {({ id }) => (
                  <>
                    <Input
                      id={id}
                      list="customer-types"
                      value={values.audienceCustomerType}
                      maxLength={60}
                      onChange={(event) => set('audienceCustomerType', event.target.value)}
                      placeholder="Consumers (B2C)"
                    />
                    <datalist id="customer-types">
                      {CUSTOMER_TYPES.map((type) => (
                        <option key={type} value={type} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            </div>

            <div className="mt-5">
              <Field
                label="Interests"
                hint="Press Enter after each one. Up to 12."
                error={form.fields.audienceInterests}
              >
                {({ id }) => (
                  <div>
                    <Input
                      id={id}
                      value={interestDraft}
                      maxLength={40}
                      onChange={(event) => setInterestDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault()
                          addInterest()
                        }
                      }}
                      onBlur={addInterest}
                      placeholder="Home decor, self-care, gifting"
                    />
                    {values.audienceInterests.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {values.audienceInterests.map((interest) => (
                          <li
                            key={interest}
                            className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-0.5 pl-2.5 pr-1 text-[12.5px] text-ink-800"
                          >
                            {interest}
                            <button
                              type="button"
                              aria-label={`Remove ${interest}`}
                              onClick={() =>
                                set(
                                  'audienceInterests',
                                  values.audienceInterests.filter((item) => item !== interest),
                                )
                              }
                              className="rounded-full p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-800"
                            >
                              <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Field>
            </div>

            <div className="mt-5">
              <Field
                label="Pain points"
                hint="What frustrates them, or stops them buying."
                error={form.fields.audiencePainPoints}
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={3}
                    maxLength={2000}
                    value={values.audiencePainPoints}
                    onChange={(event) => set('audiencePainPoints', event.target.value)}
                    placeholder="Candles that smell synthetic, or burn out in a week."
                  />
                )}
              </Field>
            </div>
          </StepFrame>
        )}

        {step === 3 && (
          <StepFrame title="Where will it run?" hint="Nexa only writes for the platforms you pick.">
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Platforms">
              {PLATFORMS.map((platform) => {
                const selected = values.platforms.includes(platform)
                return (
                  <ChoiceCard
                    key={platform}
                    multi
                    selected={selected}
                    onSelect={() =>
                      set(
                        'platforms',
                        selected
                          ? values.platforms.filter((item) => item !== platform)
                          : [...values.platforms, platform],
                      )
                    }
                    title={PLATFORM_LABEL[platform]}
                  />
                )
              })}
            </div>
          </StepFrame>
        )}

        {step === 4 && (
          <StepFrame title="How should it feel?">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {STYLES.map((style) => (
                <ChoiceCard
                  key={style}
                  selected={values.style === style}
                  onSelect={() => set('style', style)}
                  title={STYLE_OPTIONS[style].label}
                  description={STYLE_OPTIONS[style].description}
                />
              ))}
            </div>
          </StepFrame>
        )}

        {step === 5 && (
          <StepFrame title="Review">
            {Object.keys(form.fields).length > 0 && (
              <ul className="mb-5 space-y-1 rounded-lg border border-danger-border bg-danger-surface p-3 text-[13.5px] text-danger-text">
                {Object.entries(form.fields).map(([key, message]) => {
                  const target = FIELD_STEP[key.split('.')[0]] ?? 5
                  return (
                    <li key={key}>
                      {message}{' '}
                      {target !== 5 && (
                        <button type="button" onClick={() => setStep(target)} className="font-medium underline">
                          Go to {STEPS[target]}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-[10rem_1fr]">
              <ReviewRow label="Product" value={productName} onEdit={() => setStep(0)} />
              <ReviewRow label="Goal" value={values.goal ? GOAL_OPTIONS[values.goal].label : '—'} onEdit={() => setStep(1)} />
              <ReviewRow
                label="Audience"
                value={
                  [
                    values.audienceAgeRange,
                    values.audienceLocation,
                    values.audienceCustomerType,
                    values.audienceInterests.join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'From your Brand Kit'
                }
                onEdit={() => setStep(2)}
              />
              <ReviewRow
                label="Platforms"
                value={values.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}
                onEdit={() => setStep(3)}
              />
              <ReviewRow label="Style" value={values.style ? STYLE_OPTIONS[values.style].label : '—'} onEdit={() => setStep(4)} />
            </dl>

            <div className="mt-6 max-w-md">
              <Field label="Campaign name" hint="Optional." error={form.fields.name}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={values.name}
                    maxLength={120}
                    onChange={(event) => set('name', event.target.value)}
                    placeholder={productName && values.goal ? `${productName} — ${GOAL_OPTIONS[values.goal].label}` : ''}
                  />
                )}
              </Field>
            </div>

            <div className="mt-6 rounded-xl bg-ink-50 p-4 text-[13.5px] leading-relaxed text-ink-700 ring-1 ring-ink-200">
              {campaignId ? (
                <>Saving updates the brief. The current plan stays until you choose to regenerate it.</>
              ) : (
                <>
                  Generating writes the strategy, hooks, content ideas, video concepts, ad copy, captions,
                  calls to action and a 14-day calendar. It costs <strong>{cost} credits</strong>, charged
                  only if it succeeds. You have {balance.toLocaleString()}.
                  {!canAfford && (
                    <span className="mt-1 block font-medium text-danger-text">
                      Not enough credits to generate now — you can still save it as a draft.
                    </span>
                  )}
                </>
              )}
            </div>
          </StepFrame>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {step === 0 ? (
          <LinkButton href={campaignId ? `/campaigns/${campaignId}` : '/campaigns'} variant="ghost">
            Cancel
          </LinkButton>
        ) : (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={form.submitting}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        )}

        {step < STEPS.length - 1 ? (
          <div className="flex items-center gap-3">
            {currentBlocker && <span className="text-[13px] text-ink-500">{currentBlocker}</span>}
            <Button onClick={() => setStep(step + 1)} disabled={Boolean(currentBlocker)}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : campaignId ? (
          <Button onClick={() => submit(false)} disabled={form.submitting}>
            {form.submitting ? <Spinner label="Saving" /> : 'Save brief'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => submit(false)} disabled={form.submitting}>
              Save as draft
            </Button>
            <Button onClick={() => submit(true)} disabled={form.submitting || !canAfford}>
              {form.submitting ? (
                <Spinner label="Creating" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Generate campaign
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function StepFrame({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">{title}</h2>
      {hint && <p className="mt-1 text-[14px] text-ink-600">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  multi,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description?: string
  icon?: ReactNode
  multi?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(
        'flex items-start gap-3 rounded-xl p-3.5 text-left ring-1 ring-inset transition-colors',
        selected ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-raised ring-ink-200 hover:bg-ink-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center ring-1 ring-inset',
          multi ? 'rounded' : 'rounded-full',
          selected ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-300',
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink-900">
          {icon}
          {title}
        </span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-600">{description}</span>}
      </span>
    </button>
  )
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="flex items-start justify-between gap-3 text-ink-900">
        <span className="min-w-0">{value}</span>
        <button type="button" onClick={onEdit} className="shrink-0 text-[13px] font-medium text-brand-600 hover:underline">
          Edit
        </button>
      </dd>
    </>
  )
}
