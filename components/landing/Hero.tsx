import { ArrowRight, Sparkles } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { ChatPreview } from './ChatPreview'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A single wash behind the fold. Everything below the hero sits on plain
          white, which keeps the page feeling light rather than decorated. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[42rem] bg-[radial-gradient(60%_50%_at_50%_40%,var(--color-brand-100)_0%,transparent_70%)] opacity-70"
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-brand-200 bg-raised/80 px-3.5 py-1.5 text-[13px] font-medium text-brand-700 shadow-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Free to start · No credit card required
          </p>

          <h1
            className="animate-rise mt-7 text-balance text-[40px] font-semibold leading-[1.06] tracking-tight text-ink-900 sm:text-[58px] lg:text-[66px]"
            style={{ animationDelay: '60ms' }}
          >
            Meet Nexa, your{' '}
            <span className="text-brand-600">AI assistant.</span>
          </h1>

          <p
            className="animate-rise mx-auto mt-6 max-w-2xl text-pretty text-[17px] leading-relaxed text-ink-600 sm:text-[19px]"
            style={{ animationDelay: '120ms' }}
          >
            Think faster, create more, and get things done with a powerful AI assistant built for
            everyday work.
          </p>

          <div
            className="animate-rise mt-9 flex justify-center"
            style={{ animationDelay: '180ms' }}
          >
            {/* One call to action; signing in is offered in the header. It
                always points at sign-up so the button means what it says —
                a visitor who is already signed in is sent on to the app by
                the guard on that page. */}
            <LinkButton href="/signup" size="lg" className="w-full sm:w-auto sm:px-7">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>

        <div className="animate-rise mt-16 sm:mt-20" style={{ animationDelay: '240ms' }}>
          <ChatPreview />
        </div>
      </div>
    </section>
  )
}
