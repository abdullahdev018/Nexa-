'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea, Toggle } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { NEXA_MODELS, canUseModel } from '@/lib/ai/models'
import { useApiForm } from '@/lib/hooks/useApiForm'
import type { UserPreferences } from '@/lib/types'
import { SettingsSection } from './PageHeader'
import type { PlanId } from '@/lib/billing/plans'

export function SettingsForm({
  preferences,
  plan,
}: {
  preferences: UserPreferences
  plan: PlanId
}) {
  const router = useRouter()
  const form = useApiForm()
  const [values, setValues] = useState(preferences)
  const [saved, setSaved] = useState(false)

  const dirty =
    values.defaultModel !== preferences.defaultModel ||
    values.customInstructions !== preferences.customInstructions ||
    values.enterToSend !== preferences.enterToSend

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  async function save() {
    const result = await form.submit('/api/user/preferences', values, 'PATCH')
    if (!result) return
    form.stop()
    setSaved(true)
    router.refresh()
  }

  return (
    <div>
      {form.error && <Alert className="mb-6">{form.error}</Alert>}
      {saved && (
        <Alert tone="success" className="mb-6">
          Your settings have been saved.
        </Alert>
      )}

      <SettingsSection
        title="Default model"
        description="Used for new conversations. You can still switch model in any chat."
      >
        <Field label="Model">
          {({ id }) => (
            <Select
              id={id}
              value={values.defaultModel}
              onChange={(event) =>
                setValues((current) => ({ ...current, defaultModel: event.target.value }))
              }
            >
              {NEXA_MODELS.map((model) => {
                const allowed = canUseModel(model, plan)
                return (
                  <option key={model.id} value={model.id} disabled={!allowed}>
                    {model.name}
                    {allowed ? '' : ' — Pro only'}
                  </option>
                )
              })}
            </Select>
          )}
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Custom instructions"
        description="Standing preferences Nexa follows in every conversation."
      >
        <Field
          label="What should Nexa know about how you want it to respond?"
          hint={`${values.customInstructions?.length ?? 0} of 4000 characters.`}
          error={form.fields.customInstructions}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              rows={5}
              maxLength={4000}
              value={values.customInstructions ?? ''}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  customInstructions: event.target.value || null,
                }))
              }
              placeholder="e.g. Be concise. Prefer TypeScript examples. Skip the preamble and get to the answer."
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </SettingsSection>

      <SettingsSection title="Composer">
        <div className="divide-y divide-ink-200">
          <Toggle
            label="Press Enter to send"
            description="When off, Enter adds a new line and Shift + Enter sends."
            checked={values.enterToSend}
            onChange={(next) => setValues((current) => ({ ...current, enterToSend: next }))}
          />
        </div>
      </SettingsSection>

      <div className="sticky bottom-0 -mx-1 mt-2 flex items-center justify-end gap-3 bg-surface/90 px-1 py-4 backdrop-blur">
        {dirty && <span className="text-[13px] text-ink-500">You have unsaved changes.</span>}
        <Button onClick={save} disabled={!dirty || form.submitting}>
          {form.submitting ? <Spinner label="Saving" /> : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
