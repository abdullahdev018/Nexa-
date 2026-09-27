'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { MessageSquare, PenSquare, Search } from 'lucide-react'
import { ConversationItem } from '@/components/sidebar/ConversationItem'
import type { ConversationSummary } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { DATE_GROUP_ORDER, groupForDate, type DateGroup } from '@/lib/utils/format'

/**
 * The AI Assistant's own conversation list.
 *
 * It lives here rather than in the main sidebar because the main sidebar is
 * now the product navigation — chat history is one section's concern, not the
 * spine of the app.
 */
export function AssistantPanel({
  conversations,
  children,
}: {
  conversations: ConversationSummary[]
  children: ReactNode
}) {
  const router = useRouter()
  // Read from the path rather than a prop: a layout is not given the params of
  // its dynamic children, and this component already re-renders on navigation.
  const pathname = usePathname()
  const activeId = pathname.startsWith('/chat/') ? pathname.slice('/chat/'.length) : null
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const [listOpen, setListOpen] = useState(false)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = conversations.filter((item) => !pending.includes(item.id))
    if (!needle) return list
    return list.filter((item) => item.title.toLowerCase().includes(needle))
  }, [conversations, query, pending])

  const grouped = useMemo(() => {
    const pinned = visible.filter((item) => item.pinned)
    const buckets = new Map<DateGroup, ConversationSummary[]>()
    for (const item of visible.filter((entry) => !entry.pinned)) {
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
    setPending((current) => [...current, id])
    const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setPending((current) => current.filter((item) => item !== id))
      return
    }
    if (id === activeId) router.push('/chat')
    router.refresh()
  }

  const list = (
    <>
      <div className="px-3 pt-3">
        <Link
          href="/chat"
          onClick={() => setListOpen(false)}
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

      <div className="scroll-subtle mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {visible.length === 0 ? (
          <p className="px-2.5 py-6 text-[13px] leading-relaxed text-ink-500">
            {query ? 'No chats match that search.' : 'Your conversations will appear here.'}
          </p>
        ) : (
          <>
            {grouped.pinned.length > 0 && (
              <section className="mb-4">
                <h2 className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
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
                <h2 className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
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
      </div>
    </>
  )

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[16rem] shrink-0 flex-col border-r border-ink-200 bg-ink-50 xl:flex">
        {list}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Below xl the list collapses into a toggle, so the composer keeps
            the full width on a laptop and a phone alike. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-ink-200 px-3 py-2 xl:hidden">
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            aria-expanded={listOpen}
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100"
          >
            <MessageSquare className="h-4 w-4 text-ink-400" aria-hidden="true" />
            Chats
            {conversations.length > 0 && (
              <span className="rounded-full bg-ink-200 px-1.5 text-[11px] tabular-nums text-ink-600">
                {conversations.length}
              </span>
            )}
          </button>
        </div>

        <div className={cn('min-h-0 flex-1', listOpen && 'hidden xl:block')}>{children}</div>

        {listOpen && (
          <div className="flex min-h-0 flex-1 flex-col bg-ink-50 xl:hidden">{list}</div>
        )}
      </div>
    </div>
  )
}
