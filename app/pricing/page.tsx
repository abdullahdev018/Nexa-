import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'
import { PricingTable } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { CallToAction } from '@/components/landing/CallToAction'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Nexa AI pricing. Start free with unlimited conversations, or upgrade to Pro for the most capable model.',
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
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Pricing
            </p>
            <h1 className="mt-3 text-balance text-[36px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[48px]">
              Simple pricing that scales with the work
            </h1>
            <p className="mt-4 text-pretty text-[17px] leading-relaxed text-ink-600">
              Everything that makes Nexa useful day to day is free. Pro adds the most capable model
              and more room to use it.
            </p>
          </div>

          <PricingTable withHeading={false} signedIn={signedIn} />

          <p className="mx-auto mt-10 max-w-2xl text-center text-[13.5px] leading-relaxed text-ink-500">
            Paid plans are not yet open for self-service checkout. Create a free account and we will
            let you know the moment Pro is available.
          </p>
        </section>

        <Faq />
        <CallToAction signedIn={signedIn} />
      </main>

      <Footer />
    </>
  )
}
