import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'

export function CallToAction({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-night-900 px-6 py-16 text-center sm:px-16 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,var(--color-brand-600)_0%,transparent_65%)] opacity-40"
        />

        <div className="relative">
          <h2 className="text-balance text-[30px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
            Think faster. Create more.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-[16.5px] leading-relaxed text-night-300">
            Create an account and start your first conversation in under a minute. Free to use, with
            no credit card.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href={signedIn ? '/chat' : '/signup'} size="lg" className="w-full sm:w-auto">
              {signedIn ? 'Open Nexa' : 'Get started free'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>
            {!signedIn && (
              <LinkButton
                href="/login"
                size="lg"
                variant="secondary"
                className="w-full border-0 bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/15 sm:w-auto"
              >
                Log in
              </LinkButton>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
