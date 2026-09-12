'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'

export function SignupForm() {
  const router = useRouter()
  const form = useApiForm()
  const [values, setValues] = useState({ name: '', email: '', password: '' })

  const update = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }))
    form.clearField(key)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const result = await form.submit<{ next: string }>('/api/auth/signup', values)
    if (!result) return

    // The session cookie was set by the response; refresh so server components
    // see it, then move on to onboarding.
    router.replace(result.next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {form.error && <Alert>{form.error}</Alert>}

      <Field label="Full name" error={form.fields.name}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            autoComplete="name"
            placeholder="Alex Morgan"
            value={values.name}
            onChange={update('name')}
            aria-describedby={describedBy}
            invalid={invalid}
            required
          />
        )}
      </Field>

      <Field label="Work email" error={form.fields.email}>
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

      <Field
        label="Password"
        error={form.fields.password}
        hint="At least 8 characters, with a letter and a number."
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
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
        {form.submitting ? <Spinner label="Creating your account" /> : 'Create account'}
      </Button>
    </form>
  )
}
