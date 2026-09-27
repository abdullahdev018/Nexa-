'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Lock, Plus, Star, Trash2, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button, LinkButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { SettingsSection } from '@/components/settings/PageHeader'
import { useApiForm } from '@/lib/hooks/useApiForm'
import {
  FONT_ROLES,
  MAX_COLORS,
  MAX_FONTS,
  TONE_SUGGESTIONS,
  type BrandColor,
  type BrandFont,
  type BrandProfile,
} from '@/lib/brand/schema'

interface Values {
  name: string
  website: string
  description: string
  audience: string
  logoUrl: string
  toneOfVoice: string
  guidelines: string
  colors: BrandColor[]
  fonts: BrandFont[]
}

function toValues(brand?: BrandProfile): Values {
  return {
    name: brand?.name ?? '',
    website: brand?.website ?? '',
    description: brand?.description ?? '',
    audience: brand?.audience ?? '',
    logoUrl: brand?.logoUrl ?? '',
    toneOfVoice: brand?.toneOfVoice ?? '',
    guidelines: brand?.guidelines ?? '',
    colors: brand?.colors ?? [],
    fonts: brand?.fonts ?? [],
  }
}

/** The first message for any key under `prefix`, e.g. "colors.2.hex". */
function firstError(fields: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(fields).find((name) => name === prefix || name.startsWith(`${prefix}.`))
  return key ? fields[key] : undefined
}

/**
 * Creates a brand (no `brand`) or edits one.
 *
 * When the plan does not include the full kit, the kit fields are shown but
 * disabled and are never sent, so the server's refusal is a backstop rather
 * than something a Free user runs into.
 */
export function BrandForm({
  brand,
  kitUnlocked,
  brandCount = 0,
}: {
  brand?: BrandProfile
  kitUnlocked: boolean
  brandCount?: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const action = useApiForm()
  const [baseline, setBaseline] = useState(() => toValues(brand))
  const [values, setValues] = useState(baseline)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editing = Boolean(brand)
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    form.clearField(key)
  }

  async function save() {
    const identity = {
      name: values.name,
      website: values.website,
      description: values.description,
      audience: values.audience,
    }
    const kit = {
      logoUrl: values.logoUrl,
      toneOfVoice: values.toneOfVoice,
      guidelines: values.guidelines,
      colors: values.colors,
      fonts: values.fonts,
    }
    const body = kitUnlocked ? { ...identity, ...kit } : identity

    if (!brand) {
      const result = await form.submit<{ brand: BrandProfile }>('/api/brands', body)
      if (!result) return
      router.push(`/brand/${result.brand.id}`)
      router.refresh()
      return
    }

    const result = await form.submit<{ brand: BrandProfile }>(`/api/brands/${brand.id}`, body, 'PATCH')
    if (!result) return
    form.stop()
    // The server normalises (trims, adds https://, uppercases hex), so the
    // form adopts what was actually stored.
    const stored = toValues(result.brand)
    setBaseline(stored)
    setValues(stored)
    setSaved(true)
    router.refresh()
  }

  async function makeDefault() {
    if (!brand) return
    const result = await action.submit(`/api/brands/${brand.id}`, { isDefault: true }, 'PATCH')
    if (!result) return
    action.stop()
    router.refresh()
  }

  async function remove() {
    if (!brand) return
    const result = await action.submit(`/api/brands/${brand.id}`, {}, 'DELETE')
    if (!result) {
      setConfirmDelete(false)
      return
    }
    router.push('/brand')
    router.refresh()
  }

  const toneWords = values.toneOfVoice
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

  function toggleTone(word: string) {
    const current = values.toneOfVoice
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    const has = current.some((part) => part.toLowerCase() === word.toLowerCase())
    const next = has
      ? current.filter((part) => part.toLowerCase() !== word.toLowerCase())
      : [...current, word]
    set('toneOfVoice', next.join(', '))
  }

  return (
    <div>
      {(form.error || action.error) && (
        <Alert className="mb-6">{form.error ?? action.error}</Alert>
      )}
      {saved && (
        <Alert tone="success" className="mb-6">
          Brand saved. New generations will use it.
        </Alert>
      )}

      {brand && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-5">
          {brand.isDefault ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[12.5px] font-medium text-brand-700">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Default brand — used when a generation does not name one
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={makeDefault} disabled={action.submitting}>
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Make default
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-danger-icon hover:text-danger-text"
            onClick={() => setConfirmDelete(true)}
            disabled={action.submitting}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete brand
          </Button>
        </div>
      )}

      <SettingsSection title="Identity" description="Who the brand is and who it is for.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand name" error={form.fields.name}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={values.name}
                maxLength={80}
                onChange={(event) => set('name', event.target.value)}
                placeholder="e.g. Lumen Candles"
                aria-describedby={describedBy}
                invalid={invalid}
                autoFocus={!editing}
              />
            )}
          </Field>
          <Field label="Website" error={form.fields.website}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={values.website}
                inputMode="url"
                onChange={(event) => set('website', event.target.value)}
                placeholder="lumencandles.com"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        </div>

        <div className="mt-5 space-y-5">
          <Field
            label="What does the brand do?"
            hint="What you sell, and what makes it different."
            error={form.fields.description}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                maxLength={2000}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Hand-poured soy candles in small batches, scented with natural oils. Sold online and in 40 independent shops."
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <Field
            label="Who is it for?"
            hint="Your audience: who they are, what they want, what stops them buying."
            error={form.fields.audience}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                maxLength={2000}
                value={values.audience}
                onChange={(event) => set('audience', event.target.value)}
                placeholder="Gift buyers aged 25–45 who care about natural ingredients and will pay more for something that feels personal."
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        </div>
      </SettingsSection>

      {!kitUnlocked && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
          <p className="inline-flex items-center gap-2 text-[13.5px] text-ink-700">
            <Lock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
            Logo, colours, fonts, tone of voice and guidelines are part of the Brand Kit, included
            from Starter.
          </p>
          <LinkButton href="/billing#plans-heading" size="sm" variant="secondary">
            Compare plans
          </LinkButton>
        </div>
      )}

      <fieldset disabled={!kitUnlocked} className={kitUnlocked ? undefined : 'opacity-60'}>
        <SettingsSection
          title="Voice"
          description="How the brand sounds. Nexa writes every caption, script and ad in this voice."
        >
          <Field
            label="Tone of voice"
            hint="Pick a few words, or describe it in your own."
            error={form.fields.toneOfVoice}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={values.toneOfVoice}
                maxLength={300}
                onChange={(event) => set('toneOfVoice', event.target.value)}
                placeholder="Warm, premium, a little playful"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Tone suggestions">
            {TONE_SUGGESTIONS.map((word) => {
              const on = toneWords.includes(word.toLowerCase())
              return (
                <button
                  key={word}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTone(word)}
                  className={
                    'rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-inset transition-colors ' +
                    (on
                      ? 'bg-brand-600 text-white ring-brand-600'
                      : 'bg-raised text-ink-700 ring-ink-300 hover:bg-ink-50')
                  }
                >
                  {word}
                </button>
              )
            })}
          </div>

          <div className="mt-5">
            <Field
              label="Guidelines"
              hint="Rules Nexa should always follow: words to use or avoid, claims you cannot make."
              error={form.fields.guidelines}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  rows={4}
                  maxLength={4000}
                  value={values.guidelines}
                  onChange={(event) => set('guidelines', event.target.value)}
                  placeholder={'Always say "hand-poured", never "handmade".\nNo health claims about scents.'}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Look" description="Used to direct visuals and video plans.">
          <Field
            label="Logo URL"
            hint="A link to your logo image. File upload is not available yet."
            error={form.fields.logoUrl}
          >
            {({ id, describedBy, invalid }) => (
              <div className="flex items-center gap-3">
                <LogoPreview url={values.logoUrl} />
                <Input
                  id={id}
                  value={values.logoUrl}
                  inputMode="url"
                  onChange={(event) => set('logoUrl', event.target.value)}
                  placeholder="https://lumencandles.com/logo.png"
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              </div>
            )}
          </Field>

          <ColorsEditor
            colors={values.colors}
            onChange={(colors) => set('colors', colors)}
            error={firstError(form.fields, 'colors')}
          />
          <FontsEditor
            fonts={values.fonts}
            onChange={(fonts) => set('fonts', fonts)}
            error={firstError(form.fields, 'fonts')}
          />
        </SettingsSection>
      </fieldset>

      <div className="sticky bottom-0 z-10 -mx-1 mt-2 flex items-center justify-end gap-3 bg-surface/90 px-1 py-4 backdrop-blur">
        {editing && dirty && <span className="text-[13px] text-ink-500">You have unsaved changes.</span>}
        {!editing && (
          <LinkButton href="/brand" variant="ghost">
            Cancel
          </LinkButton>
        )}
        <Button onClick={save} disabled={(editing && !dirty) || form.submitting || !values.name.trim()}>
          {form.submitting ? <Spinner label="Saving" /> : editing ? 'Save brand' : 'Create brand'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${brand?.name ?? 'this brand'}?`}
        body={
          'This deletes the brand and its products. Campaigns and content already made with it are kept.' +
          (brand?.isDefault && brandCount > 1 ? ' Your oldest remaining brand becomes the default.' : '')
        }
        confirmLabel="Delete brand"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
        busy={action.submitting}
      />
    </div>
  )
}

function LogoPreview({ url }: { url: string }) {
  // Remembers which address failed, so typing a new one retries on its own.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = /^https?:\/\/\S+\.\S+/i.test(url.trim()) ? url.trim() : null
  const failed = src !== null && src === failedSrc

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-50 ring-1 ring-ink-200">
      {src && !failed ? (
        // A user-supplied URL on any host, so next/image's allow-list does not apply.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Logo preview" className="h-full w-full object-contain" onError={() => setFailedSrc(src)} />
      ) : (
        <span className="text-[10px] font-medium uppercase text-ink-400">{src ? 'Error' : 'Logo'}</span>
      )}
    </span>
  )
}

function ColorsEditor({
  colors,
  onChange,
  error,
}: {
  colors: BrandColor[]
  onChange: (colors: BrandColor[]) => void
  error?: string
}) {
  function update(index: number, patch: Partial<BrandColor>) {
    onChange(colors.map((color, i) => (i === index ? { ...color, ...patch } : color)))
  }

  return (
    <div className="mt-6">
      <p className="text-sm font-medium text-ink-700">Colours</p>
      {colors.length === 0 && <p className="mt-1.5 text-[13px] text-ink-500">No colours yet.</p>}
      <ul className="mt-2 space-y-2">
        {colors.map((color, index) => {
          const valid = /^#[0-9a-f]{6}$/i.test(color.hex)
          return (
            <li key={index} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Pick colour ${index + 1}`}
                value={valid ? color.hex.toLowerCase() : '#000000'}
                onChange={(event) => update(index, { hex: event.target.value.toUpperCase() })}
                className="h-10 w-11 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0.5 ring-1 ring-inset ring-ink-300"
              />
              <Input
                aria-label={`Hex value for colour ${index + 1}`}
                value={color.hex}
                maxLength={7}
                onChange={(event) => update(index, { hex: event.target.value })}
                className="w-28 font-mono uppercase"
                invalid={!valid}
              />
              <Input
                aria-label={`Name for colour ${index + 1}`}
                value={color.name}
                maxLength={40}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Primary"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove colour ${index + 1}`}
                onClick={() => onChange(colors.filter((_, i) => i !== index))}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ul>
      {error && <p className="mt-1.5 text-[13px] text-danger-icon">{error}</p>}
      {colors.length < MAX_COLORS && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => onChange([...colors, { name: '', hex: '#4F46E5' }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add colour
        </Button>
      )}
    </div>
  )
}

function FontsEditor({
  fonts,
  onChange,
  error,
}: {
  fonts: BrandFont[]
  onChange: (fonts: BrandFont[]) => void
  error?: string
}) {
  function update(index: number, patch: Partial<BrandFont>) {
    onChange(fonts.map((font, i) => (i === index ? { ...font, ...patch } : font)))
  }

  const nextRole = FONT_ROLES.find((role) => !fonts.some((font) => font.role === role)) ?? 'accent'

  return (
    <div className="mt-6">
      <p className="text-sm font-medium text-ink-700">Fonts</p>
      {fonts.length === 0 && <p className="mt-1.5 text-[13px] text-ink-500">No fonts yet.</p>}
      <ul className="mt-2 space-y-2">
        {fonts.map((font, index) => (
          <li key={index} className="flex items-center gap-2">
            <Select
              aria-label={`Use for font ${index + 1}`}
              value={font.role}
              onChange={(event) => update(index, { role: event.target.value as BrandFont['role'] })}
              className="w-32 shrink-0 capitalize"
            >
              {FONT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`Family for font ${index + 1}`}
              value={font.family}
              maxLength={60}
              onChange={(event) => update(index, { family: event.target.value })}
              placeholder="Inter"
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove font ${index + 1}`}
              onClick={() => onChange(fonts.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1.5 text-[13px] text-danger-icon">{error}</p>}
      {fonts.length < MAX_FONTS && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => onChange([...fonts, { role: nextRole, family: '' }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add font
        </Button>
      )}
    </div>
  )
}
