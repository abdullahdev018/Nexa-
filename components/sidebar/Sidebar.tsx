'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { LogOut, PenSquare, Search, Settings, User, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useDismiss } from '@/lib/hooks/useDismiss'
import type { ConversationSummary, CurrentUser } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { DATE_GROUP_ORDER, groupForDate, type DateGroup } from '@/lib/utils/format'
import { ConversationItem } from './ConversationItem'

function initials(user: CurrentUser): string {
  const source = user.name?.trim() || user.email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase()
}

export function Sidebar({
  user,
  conversations,
  activeId,
  onNavigate,
}: {
  user: CurrentUser
  conversations: ConversationSummary[]
  activeId: string | null
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const menu = useRef<HTMLDivElement>(null)
  useDismiss(menu, menuOpen, () => setMenuOpen(false))

  // Filtering by title happens locally so typing stays instant; the History
  // page does the full-text search that needs the server.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = conversations.filter((item) => !pending.includes(item.id))
    if (!needle) return list
    return list.filter((item) => item.title.toLowerCase().includes(needle))
  }, [conversations, query, pending])

  const grouped = useMemo(() => {
    const pinned = visible.filter((item) => item.pinned)
    const rest = visible.filter((item) => !item.pinned)

    const buckets = new Map<DateGroup, ConversationSummary[]>()
    for (const item of rest) {
      const group = groupForDate(item.updatedAt)
      const bucket = buckets.get(group)
      if (bucket) bucket.push(item)
      else buckets.set(group, [item])
    }

    return { pinned, buckets }
  }, [visible])

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    router.refresh()
  }

  async function remove(id: string) {
    // Hidden immediately; the refresh below makes it permanent in the list.
    setPending((current) => [...current, id])
    const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })

    if (!response.ok) {
      setPending((current) => current.filter((item) => item !== id))
      return
    }
    if (id === activeId) router.push('/chat')
    router.refresh()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col bg-ink-100">
      <div className="flex items-center justify-between px-3 py-3.5">
        <Logo size={28} withWordmark href="/chat" />
        <button
          type="button"
          onClick={onNavigate}
          className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-200 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
        </button>
      </div>

      <div className="px-3">
        <Link
          href="/chat"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg bg-raised px-3 py-2.5 text-[13.5px] font-medium text-ink-800 shadow-xs ring-1 ring-ink-200 transition-colors hover:bg-ink-50"
        >
          <PenSquare className="h-4 w-4 text-brand-600" aria-hidden="true" />
          New chat
        </Link>

        <div className="relative mt-2.5">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full rounded-lg border-0 bg-ink-200/60 py-2 pl-8 pr-3 text-[13px] text-ink-800 outline-none transition placeholder:text-ink-500 focus:bg-raised focus:ring-1 focus:ring-inset focus:ring-brand-600"
          />
        </div>
      </div>

      <nav className="scroll-subtle mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {visible.length === 0 ? (
          <p className="px-2.5 py-6 text-[13px] leading-relaxed text-ink-500">
            {query ? 'No chats match that search.' : 'Your conversations will appear here.'}
          </p>
        ) : (
          <>
            {grouped.pinned.length > 0 && (
              <section className="mb-4">
                <h2 className="px-2.5 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                  Pinned
                </h2>
                <ul className="space-y-0.5">
                  {grouped.pinned.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeId}
                      onRename={(id, title) => patch(id, { title })}
                      onTogglePin={(id, pinned) => patch(id, { pinned })}
                      onDelete={remove}
                    />
                  ))}
                </ul>
              </section>
            )}

            {DATE_GROUP_ORDER.filter((group) => grouped.buckets.has(group)).map((group) => (
              <section key={group} className="mb-4">
                <h2 className="px-2.5 pb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                  {group}
                </h2>
                <ul className="space-y-0.5">
                  {grouped.buckets.get(group)?.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeId}
                      onRename={(id, title) => patch(id, { title })}
                      onTogglePin={(id, pinned) => patch(id, { pinned })}
                      onDelete={remove}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </nav>

      <div ref={menu} className="relative border-t border-ink-200 p-3">
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-30 mb-2 overflow-hidden rounded-xl border border-ink-200 bg-raised p-1 shadow-lg">
            <Link
              href="/account"
              onClick={() => {
                setMenuOpen(false)
                onNavigate?.()
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-700 hover:bg-ink-50"
            >
              <User className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Account
            </Link>
            <Link
              href="/settings"
              onClick={() => {
                setMenuOpen(false)
                onNavigate?.()
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-700 hover:bg-ink-50"
            >
              <Settings className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Settings
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-700 hover:bg-ink-50"
            >
              <LogOut className="h-4 w-4 text-ink-400" aria-hidden="true" />
              Log out
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-200/60',
          )}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-semibold text-white">
            {initials(user)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-ink-900">
              {user.name ?? user.email}
            </span>
            <span className="block truncate text-[12px] text-ink-500">
              {user.plan === 'FREE' ? 'Free plan' : `${user.plan.charAt(0)}${user.plan.slice(1).toLowerCase()} plan`}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
