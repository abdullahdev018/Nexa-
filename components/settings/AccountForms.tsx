'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const form = useApiForm()
  const [value, setValue] = useState(name)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [saved])

  async function save() {
    const result = await form.submit('/api/user', { name: value }, 'PATCH')
    if (!result) return
    form.stop()
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="max-w-md space-y-5">
      {form.error && <Alert>{form.error}</Alert>}
      {saved && <Alert tone="success">Your profile has been updated.</Alert>}

      <Field label="Name" error={form.fields.name}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              form.clearField('name')
            }}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Email" hint="Your email address cannot be changed.">
        {({ id, describedBy }) => (
          <Input id={id} value={email} disabled readOnly aria-describedby={describedBy} />
        )}
      </Field>

      <Button onClick={save} disabled={form.submitting || value.trim() === name}>
        {form.submitting ? <Spinner label="Saving" /> : 'Save'}
      </Button>
    </div>
  )
}

export function PasswordForm() {
  const form = useApiForm()
  const [values, setValues] = useState({ currentPassword: '', newPassword: '' })
  const [saved, setSaved] = useState(false)

  const update = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    form.clearField(key)
  }

  async function save() {
    const result = await form.submit('/api/user/password', values)
    if (!result) return
    form.stop()
    setValues({ currentPassword: '', newPassword: '' })
    setSaved(true)
  }

  return (
    <div className="max-w-md space-y-5">
      {form.error && <Alert>{form.error}</Alert>}
      {saved && (
        <Alert tone="success">
          Your password has been changed. Any other devices have been signed out.
        </Alert>
      )}

      <Field label="Current password" error={form.fields.currentPassword}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={update('currentPassword')}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field
        label="New password"
        hint="At least 8 characters, with a letter and a number."
        error={form.fields.newPassword}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={update('newPassword')}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Button
        onClick={save}
        disabled={form.submitting || !values.currentPassword || !values.newPassword}
      >
        {form.submitting ? <Spinner label="Updating password" /> : 'Change password'}
      </Button>
    </div>
  )
}

export function DangerZone({ conversationCount }: { conversationCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteAccount() {
    setBusy(true)
    setError(null)

    const response = await fetch('/api/user', { method: 'DELETE' })
    if (!response.ok) {
      setBusy(false)
      setError('Your account could not be deleted. Please try again.')
      return
    }

    // The session row went with the account; go somewhere public.
    router.push('/')
    router.refresh()
  }

  return (
    <div>
      {error && <Alert className="mb-5">{error}</Alert>}

      <div className="rounded-xl border border-danger-border bg-danger-surface/60 p-5">
        <h3 className="text-[15px] font-semibold text-ink-900">Delete your account</h3>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-600">
          This permanently removes your account, your settings and all{' '}
          {conversationCount === 1 ? '1 conversation' : `${conversationCount} conversations`}. It
          cannot be undone.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        busy={busy}
        title="Delete your account?"
        body="Everything — your conversations, settings and sign-in — is removed immediately and permanently. This cannot be undone."
        confirmLabel={busy ? 'Deleting…' : 'Delete everything'}
        onConfirm={deleteAccount}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
