import type { ReactNode } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'

/** Shared frame for the marketing-side pages that are mostly prose. */
export function LegalLayout({
  title,
  updated,
  signedIn,
  children,
}: {
  title: string
  updated: string
  signedIn: boolean
  children: ReactNode
}) {
  return (
    <>
      <Navbar signedIn={signedIn} />

      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="text-[34px] font-semibold tracking-tight text-ink-900 sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-3 text-[14px] text-ink-500">Last updated {updated}</p>

        <div className="mt-12 space-y-10 text-[16px] leading-relaxed text-ink-700 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink-900 [&_li]:leading-relaxed [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <Footer />
    </>
  )
}
