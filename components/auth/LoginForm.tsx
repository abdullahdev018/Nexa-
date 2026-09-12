'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const form = useApiForm()
  const [values, setValues] = useState({ email: '', password: '' })

  const update = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    form.clearField(key)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const result = await form.submit<{ next: string }>('/api/auth/login', values)
    if (!result) return

    // Honour where the user was headed before being asked to sign in, but only
    // for in-app paths — an absolute URL here would be an open redirect.
    const safe =
      redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null
    router.replace(safe ?? result.next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {form.error && <Alert>{form.error}</Alert>}

      <Field label="Email" error={form.fields.email}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={values.email}
            onChange={update('email')}
            aria-describedby={describedBy}
            invalid={invalid}
            required
          />
        )}
      </Field>

      <Field label="Password" error={form.fields.password}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={values.password}
            onChange={update('password')}
            aria-describedby={describedBy}
            invalid={invalid}
            required
          />
        )}
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={form.submitting}>
        {form.submitting ? <Spinner label="Signing in" /> : 'Log in'}
      </Button>
    </form>
  )
}
