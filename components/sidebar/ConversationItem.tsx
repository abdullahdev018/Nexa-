'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import { useDismiss } from '@/lib/hooks/useDismiss'
import type { ConversationSummary } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

export function ConversationItem({
  conversation,
  active,
  onRename,
  onTogglePin,
  onDelete,
}: {
  conversation: ConversationSummary
  active: boolean
  onRename: (id: string, title: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const menu = useRef<HTMLDivElement>(null)
  useDismiss(menu, menuOpen, () => setMenuOpen(false))

  function commitRename() {
    const title = draft.trim()
    setRenaming(false)
    if (title && title !== conversation.title) onRename(conversation.id, title)
    else setDraft(conversation.title)
  }

  if (renaming) {
    return (
      <li>
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') {
              setDraft(conversation.title)
              setRenaming(false)
            }
          }}
          className="w-full rounded-lg border border-brand-500 bg-raised px-2.5 py-2 text-[13.5px] text-ink-900 outline-none"
          aria-label="Conversation title"
        />
      </li>
    )
  }

  return (
    <li className="group/item relative">
      <Link
        href={`/chat/${conversation.id}`}
        className={cn(
          'flex items-center gap-2 rounded-lg py-2 pl-2.5 pr-8 text-[13.5px] transition-colors',
          active
            ? 'bg-ink-200/70 font-medium text-ink-900'
            : 'text-ink-700 hover:bg-ink-200/50 hover:text-ink-900',
        )}
      >
        {conversation.pinned && (
          <Pin className="h-3 w-3 shrink-0 text-ink-400" aria-label="Pinned" />
        )}
        <span className="truncate">{conversation.title}</span>
      </Link>

      <div ref={menu}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Actions for ${conversation.title}`}
          aria-expanded={menuOpen}
          className={cn(
            'absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-500 transition-opacity hover:bg-ink-300/60 hover:text-ink-800',
            // Always reachable by keyboard; only visible on hover or when open.
            menuOpen ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover/item:opacity-100',
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-1 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-ink-200 bg-raised p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setRenaming(true)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-700 hover:bg-ink-50"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onTogglePin(conversation.id, !conversation.pinned)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-700 hover:bg-ink-50"
            >
              {conversation.pinned ? (
                <>
                  <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  Pin
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onDelete(conversation.id)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-danger-icon hover:bg-danger-surface"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
