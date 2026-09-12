'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp, FileText, ImageIcon, Paperclip, Square, X } from 'lucide-react'
import type { Attachment } from '@/lib/ai/types'
import { readAttachment } from '@/lib/hooks/useChatStream'
import { cn } from '@/lib/utils/cn'
import { ModelPicker } from './ModelPicker'

const MAX_ATTACHMENTS = 5
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,.txt,.md,.csv,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.sql,.sh,.css,.html,.xml'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Composer({
  onSend,
  onStop,
  streaming,
  model,
  onModelChange,
  plan,
  enterToSend,
  autoFocus,
  initialValue = '',
}: {
  onSend: (message: string, attachments: Attachment[]) => void
  onStop: () => void
  streaming: boolean
  model: string
  onModelChange: (modelId: string) => void
  plan: 'FREE' | 'PRO' | 'TEAM'
  enterToSend: boolean
  autoFocus?: boolean
  /** Seeds the box — the parent remounts the composer to apply a new one. */
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Grow with the content up to a ceiling, then scroll inside the box.
  useEffect(() => {
    const node = textarea.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 224)}px`
  }, [value])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !streaming

  function submit() {
    if (!canSend) return
    onSend(value.trim(), attachments)
    setValue('')
    setAttachments([])
    textarea.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return

    // The preference decides which of Enter / Shift+Enter sends, so both
    // habits are supported without a second control.
    const sends = enterToSend ? !event.shiftKey : event.shiftKey
    if (sends && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const room = MAX_ATTACHMENTS - attachments.length
    if (room <= 0) {
      setNotice(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
      return
    }

    const accepted: Attachment[] = []
    const rejected: string[] = []

    for (const file of files.slice(0, room)) {
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} is larger than 5 MB`)
        continue
      }
      try {
        accepted.push(await readAttachment(file))
      } catch {
        rejected.push(`${file.name} could not be read`)
      }
    }

    if (accepted.length > 0) setAttachments((current) => [...current, ...accepted])
    if (files.length > room) rejected.push(`only the first ${room} were added`)
    if (rejected.length > 0) setNotice(rejected.join('; '))
  }

  return (
    <div className="px-4 pb-4 pt-2 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {notice && (
          <p role="status" className="mb-2 text-[12.5px] text-warn-text">
            {notice}
          </p>
        )}

        <div className="rounded-2xl border border-ink-200 bg-raised shadow-sm transition-shadow focus-within:border-ink-300 focus-within:shadow-md">
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
              {attachments.map((attachment, index) => (
                <li
                  key={`${attachment.name}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-2.5 pr-1.5 text-[12.5px]"
                >
                  {attachment.kind === 'image' ? (
                    <ImageIcon className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
                  )}
                  <span className="max-w-[12rem] truncate text-ink-700">{attachment.name}</span>
                  <span className="text-ink-400">{formatBytes(attachment.size)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((current) => current.filter((_, i) => i !== index))
                    }
                    className="rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <textarea
            ref={textarea}
            id="composer"
            rows={1}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Nexa anything…"
            aria-label="Message Nexa"
            className="scroll-subtle block max-h-56 w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-400"
          />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <div className="flex items-center gap-1">
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPT}
                onChange={onFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={streaming}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
                aria-label="Attach files"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <ModelPicker
                value={model}
                onChange={onModelChange}
                plan={plan}
                disabled={streaming}
              />
            </div>

            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-night-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-night-800"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  canSend
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'cursor-not-allowed bg-ink-200 text-ink-400',
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11.5px] text-ink-400">
          Nexa can make mistakes. Check important information.
        </p>
      </div>
    </div>
  )
}
