import { getCurrentUser } from '@/lib/auth/session'
import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Models } from '@/components/landing/Models'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { CallToAction } from '@/components/landing/CallToAction'
import { Footer } from '@/components/landing/Footer'

/**
 * The landing page reads the session so every call to action points somewhere
 * true: a signed-in visitor is offered the app, not another sign-up form.
 */
export default async function HomePage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Navbar signedIn={signedIn} />

      <main id="main">
        <Hero />
        <Features />
        <HowItWorks signedIn={signedIn} />
        <Models />
        <Pricing signedIn={signedIn} />
        <Faq />
        <CallToAction signedIn={signedIn} />
      </main>

      <Footer />
    </>
  )
}
