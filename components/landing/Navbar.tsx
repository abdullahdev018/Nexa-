'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { LinkButton } from '@/components/ui/Button'
import { NAV_LINKS } from '@/lib/content/landing'
import { cn } from '@/lib/utils/cn'

/**
 * Transparent over the hero, then gains a border and blur once the page moves,
 * so the bar never competes with the headline but stays legible over content.
 */
export function Navbar({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The mobile sheet covers the page; letting the page behind it scroll is
  // disorienting on touch.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors duration-200',
        scrolled ? 'border-b border-ink-200 bg-surface/85 backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo size={30} withWordmark />

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <LinkButton href="/chat" size="sm">
              Open Nexa
            </LinkButton>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                Log in
              </Link>
              <LinkButton href="/signup" size="sm">
                Sign up
              </LinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-700 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-ink-200 bg-raised px-5 pb-6 pt-2 md:hidden"
        >
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-[15px] font-medium text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {signedIn ? (
              <LinkButton href="/chat" size="lg" className="w-full">
                Open Nexa
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/signup" size="lg" className="w-full">
                  Sign up
                </LinkButton>
                <LinkButton href="/login" variant="secondary" size="lg" className="w-full">
                  Log in
                </LinkButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
