'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Sidebar } from '@/components/sidebar/Sidebar'
import type { ConversationSummary, CurrentUser } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

/**
 * The signed-in frame: a permanent sidebar from `lg` up, a slide-over drawer
 * below it. The sidebar lives here rather than in each page so navigating
 * between chats never re-mounts it.
 */
export function AppShell({
  user,
  conversations,
  children,
}: {
  user: CurrentUser
  conversations: ConversationSummary[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const [lastPath, setLastPath] = useState(pathname)

  const activeId = pathname.startsWith('/chat/') ? pathname.slice('/chat/'.length) : null

  // Any navigation closes the drawer — otherwise it stays open over the page
  // the user just asked for. Adjusted during render rather than in an effect,
  // so the drawer never paints open on the new route first.
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawerOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="flex h-full">
      <aside className="hidden w-[17.5rem] shrink-0 border-r border-ink-200 lg:block">
        <Sidebar user={user} conversations={conversations} activeId={activeId} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={cn(
            'absolute inset-0 bg-night-900/40 transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[17.5rem] max-w-[85vw] shadow-xl transition-transform duration-200',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar
            user={user}
            conversations={conversations}
            activeId={activeId}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open sidebar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo size={26} withWordmark href="/chat" />
        </header>

        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
