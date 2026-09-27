import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { FOOTER_LINKS } from '@/lib/content/landing'

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-raised">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo size={30} withWordmark />
            <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-ink-600">
              Your AI marketing team. Give Nexa your product; it builds your marketing campaign.
            </p>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                {group.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[14.5px] text-ink-700 transition-colors hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-ink-500">
            © {new Date().getFullYear()} Nexa AI. All rights reserved.
          </p>
          <p className="text-[13.5px] text-ink-500">
            Nexa can make mistakes. Check important information.
          </p>
        </div>
      </div>
    </footer>
  )
}
