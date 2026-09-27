'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Lock, Plus, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { CreditMeter } from './CreditMeter'
import { UpgradeDialog } from './UpgradeDialog'
import { UserMenu } from './UserMenu'
import { NAV_GROUPS, activeNavItem } from '@/lib/content/navigation'
import { planAllows, type PlanLimits } from '@/lib/billing/plans'
import type { CreditSummary, CurrentUser, WorkspaceSummary } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { ComingSoon } from '@/components/ui/ComingSoon'

/**
 * The product navigation. This is what makes Nexa read as a marketing
 * workspace rather than a chat app: the sections are the work, and the
 * conversation list has moved inside the AI Assistant where it belongs.
 */
export function WorkspaceNav({
  user,
  workspace,
  credits,
  onNavigate,
}: {
  user: CurrentUser
  workspace: WorkspaceSummary
  credits: CreditSummary
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = activeNavItem(pathname)
  const [upgrade, setUpgrade] = useState<{ feature: keyof PlanLimits; href: string } | null>(null)
  const closeUpgrade = useCallback(() => setUpgrade(null), [])

  return (
    <div className="flex h-full flex-col bg-ink-100">
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <Logo size={26} withWordmark href="/dashboard" />
          <p className="mt-2 truncate text-[12px] text-ink-500" title={workspace.name}>
            {workspace.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-ink-200 lg:hidden"
          aria-label="Close menu"
        >
          <X style={{ height: 18, width: 18 }} />
        </button>
      </div>

      <div className="px-3 pb-1">
        <Link
          href="/campaigns"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-[13.5px] font-medium text-white shadow-xs transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Campaign
        </Link>
      </div>

      <nav className="scroll-subtle mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, index) => (
          <section key={group.label ?? `group-${index}`} className="mb-4 last:mb-0">
            {group.label && (
              <h2 className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {group.label}
              </h2>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const current = active?.href === item.href
                // Locked means the plan does not include it; it is still
                // visible, because hiding what the product does helps nobody.
                const locked = item.requires ? !planAllows(workspace.plan, item.requires) : false

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        // A locked section opens the plan that unlocks it
                        // rather than a page that cannot be used. Modified
                        // clicks (new tab) still go straight there.
                        if (locked && item.requires && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                          event.preventDefault()
                          setUpgrade({ feature: item.requires, href: item.href })
                          return
                        }
                        onNavigate?.()
                      }}
                      aria-current={current ? 'page' : undefined}
                      title={item.description}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                        current
                          ? 'bg-raised font-medium text-ink-900 shadow-xs ring-1 ring-ink-200'
                          : 'text-ink-700 hover:bg-ink-200/60 hover:text-ink-900',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          current ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-500',
                        )}
                        aria-hidden="true"
                      />
                      {/* The badge sits under the name, so the name is never truncated to fit it. */}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {!item.built && <ComingSoon size="xs" className="mt-1" />}
                      </span>

                      {item.built && locked ? (
                        <Lock className="h-3 w-3 shrink-0 text-ink-400" aria-label="Not on your plan" />
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className="space-y-2 border-t border-ink-200 p-3">
        <CreditMeter credits={credits} onNavigate={onNavigate} />
        <UserMenu user={user} workspace={workspace} onNavigate={onNavigate} />
      </div>

      {upgrade && (
        <UpgradeDialog
          open
          plan={workspace.plan}
          feature={upgrade.feature}
          previewHref={upgrade.href}
          onClose={closeUpgrade}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
