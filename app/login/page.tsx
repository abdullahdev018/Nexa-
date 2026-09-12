import type { Metadata } from 'next'
import Link from 'next/link'
import { requireGuest } from '@/lib/auth/guards'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to Nexa AI.',
  robots: { index: false, follow: true },
}

export default async function LoginPage(props: PageProps<'/login'>) {
  await requireGuest()

  const params = await props.searchParams
  const next = typeof params.next === 'string' ? params.next : undefined

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New to Nexa?{' '}
          <Link href="/signup" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm redirectTo={next} />
    </AuthShell>
  )
}
