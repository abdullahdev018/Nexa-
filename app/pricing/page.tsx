import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'
import { CreditCosts, PlanMatrix, PricingTable } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { CallToAction } from '@/components/landing/CallToAction'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Nexa AI pricing: start free with monthly credits, then grow into Starter, Pro or Agency for the full Brand Kit, a marketing calendar, video plans and analytics.',
}

export default async function PricingPage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)

  return (
    <>
      <Navbar signedIn={signedIn} />

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-600">Pricing</p>
            <h1 className="mt-3 text-balance text-[36px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[48px]">
              A marketing team, priced like a tool
            </h1>
            <p className="mt-4 text-pretty text-[17px] leading-relaxed text-ink-600">
              Every plan runs on monthly credits. Start free with one brand; move up when you need the full Brand Kit,
              a calendar, video plans or analytics.
            </p>
          </div>

          <PricingTable withHeading={false} signedIn={signedIn} />
        </section>

        <section aria-labelledby="compare-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 id="compare-heading" className="mb-6 text-center text-[26px] font-semibold tracking-tight text-ink-900">
            Compare plans
          </h2>
          <PlanMatrix />
          <div className="mt-12">
            <CreditCosts />
          </div>
        </section>

        <Faq />
        <CallToAction signedIn={signedIn} />
      </main>

      <Footer />
    </>
  )
}
