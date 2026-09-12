import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGuest } from '@/lib/auth/guards'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a free Nexa AI account.',
  robots: { index: false, follow: true },
}

export default async function SignupPage() {
  await requireGuest()

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. No credit card required."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  )
}
