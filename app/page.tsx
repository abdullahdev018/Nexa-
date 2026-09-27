import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Honesty } from '@/components/landing/Honesty'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { CallToAction } from '@/components/landing/CallToAction'
import { Footer } from '@/components/landing/Footer'

/**
 * The landing page is the pitch, and the pitch is for people who have not
 * bought yet. Someone with an account arriving at the root is sent straight
 * into the app rather than being shown log in and sign up again — the same
 * rule /login and /signup already follow — to their dashboard.
 *
 * Everything below the redirect therefore renders for a signed-out visitor,
 * which is why `signedIn` is passed as false. The marketing sections still
 * take the prop because /pricing and the legal pages render them for signed-in
 * readers, where the call to action does need to point at the app.
 */
export default async function HomePage() {
  if (await getCurrentUser()) redirect('/dashboard')

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Navbar signedIn={false} />

      <main id="main">
        <Hero />
        <Features />
        <HowItWorks signedIn={false} />
        <Honesty />
        <Pricing signedIn={false} />
        <Faq />
        <CallToAction signedIn={false} />
      </main>

      <Footer />
    </>
  )
}
