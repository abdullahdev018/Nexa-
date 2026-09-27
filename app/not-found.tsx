import { LinkButton } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 py-20 text-center">
      <Logo size={36} withWordmark />

      <p className="mt-10 text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-600">
        404
      </p>
      <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-ink-900 sm:text-[36px]">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-600">
        The link may be broken, or what it pointed to may have been deleted.
      </p>

      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
        <LinkButton href="/dashboard" size="lg">
          Go to your dashboard
        </LinkButton>
        <LinkButton href="/" variant="secondary" size="lg">
          Back to home
        </LinkButton>
      </div>
    </div>
  )
}
