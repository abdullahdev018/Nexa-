'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, FileText, ImageIcon } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import type { UiMessage } from '@/lib/types'
import { cn } from '@/lib/utils/cn'
import { Markdown } from './Markdown'

function Attachments({ items }: { items: NonNullable<UiMessage['attachments']> }) {
  if (items.length === 0) return null
  return (
    <ul className="mb-2 flex flex-wrap justify-end gap-1.5">
      {items.map((item, index) => (
        <li
          key={`${item.name}-${index}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[12px] text-white/90"
        >
          {item.kind === 'image' ? (
            <ImageIcon className="h-3 w-3" aria-hidden="true" />
          ) : (
            <FileText className="h-3 w-3" aria-hidden="true" />
          )}
          <span className="max-w-[10rem] truncate">{item.name}</span>
        </li>
      ))}
    </ul>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          // Clipboard can be unavailable; the text is selectable regardless.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          Copy
        </>
      )}
    </button>
  )
}

export function Message({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          {message.attachments && message.attachments.length > 0 && (
            <Attachments items={message.attachments} />
          )}
          {message.content && (
            <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white">
              {message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-3">
      <Logo size={28} href={null} className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        {message.content ? (
          <Markdown content={message.content} />
        ) : message.streaming ? (
          <span className="inline-flex items-center gap-1 py-2" aria-label="Nexa is thinking">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-ink-400"
                style={{ animation: 'var(--animate-dot)', animationDelay: `${dot * 0.15}s` }}
              />
            ))}
          </span>
        ) : null}

        {/* A cursor while text is arriving, so a slow reply never looks stalled. */}
        {message.streaming && message.content && (
          <span className="ml-0.5 inline-block animate-blink align-baseline text-ink-500">▍</span>
        )}

        {message.error && (
          <p className="mt-2 inline-flex items-start gap-2 rounded-lg border border-warn-border bg-warn-surface px-3 py-2 text-[13px] text-warn-text">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {message.error}
          </p>
        )}

        {!message.streaming && message.content && (
          <div
            className={cn(
              'mt-1.5 -ml-2 flex items-center gap-1 transition-opacity',
              'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
            )}
          >
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}
