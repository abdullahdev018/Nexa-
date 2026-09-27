import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

const POINTS = [
  'A whole campaign from one product brief',
  'Posts, video plans and ad copy in your brand’s voice',
  'A calendar to plan it — you stay in control of what goes out',
]

/**
 * Two-column auth layout: the form on the left, a quiet brand panel on the
 * right that collapses away below `lg` so the form is never pushed down the
 * page on a phone.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string
  subtitle: ReactNode
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full">
      <div className="flex w-full flex-col px-5 py-8 sm:px-8 lg:w-[52%] lg:px-16">
        <Logo size={32} withWordmark />

        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-8 text-center text-[14.5px] text-ink-600">{footer}</p>
        </div>

        <p className="text-center text-[13px] text-ink-500 lg:text-left">
          By continuing you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink-800">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-800">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-night-900 lg:flex lg:w-[48%] lg:flex-col lg:justify-center lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_20%,var(--color-brand-600)_0%,transparent_65%)] opacity-45"
        />

        <div className="relative max-w-md">
          <p className="text-[32px] font-semibold leading-tight tracking-tight text-white">
            Your AI
            <br />
            marketing team.
          </p>
          <p className="mt-5 text-[16px] leading-relaxed text-night-300">
            Give Nexa your product. Nexa builds your marketing campaign — strategy, content, video
            plans and ads, ready for you to publish.
          </p>

          <ul className="mt-10 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-night-200">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-brand-300">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
