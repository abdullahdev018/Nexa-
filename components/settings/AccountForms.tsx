'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
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
  const form = useApiForm()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  async function deleteAccount() {
    const result = await form.submit('/api/user', { password }, 'DELETE')
    if (!result) return
    // The session row went with the account; go somewhere public.
    router.push('/')
    router.refresh()
  }

  return (
    <div>
      <div className="rounded-xl border border-danger-border bg-danger-surface/60 p-5">
        <h3 className="text-[15px] font-semibold text-ink-900">Delete your account</h3>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-600">
          This permanently removes your account and settings,{' '}
          {conversationCount === 1 ? '1 conversation' : `${conversationCount} conversations`}, and every workspace you
          own — with its brands, campaigns, content, video plans, ads, calendar, imported results and credit history.
          It cannot be undone.
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => {
            setPassword('')
            form.reset()
            setOpen(true)
          }}
        >
          Delete account
        </Button>
      </div>

      <Modal open={open} title="Delete your account?" onClose={() => setOpen(false)} busy={form.submitting}>
        <p className="text-[14.5px] leading-relaxed text-ink-600">
          Everything is removed immediately and permanently: your sign-in, your conversations, and every workspace you
          own with all of its work. Enter your password to confirm.
        </p>
        {form.error && !form.fields.password && <Alert className="mt-4">{form.error}</Alert>}
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            void deleteAccount()
          }}
        >
          <Field label="Password" error={form.fields.password}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  form.clearField('password')
                }}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={form.submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={form.submitting || !password}>
              {form.submitting ? <Spinner label="Deleting" /> : 'Delete everything'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
