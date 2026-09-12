'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { PREVIEW_TURNS } from '@/lib/content/landing'
import { cn } from '@/lib/utils/cn'

/** Renders the preview's **bold** spans without pulling in a markdown parser. */
function renderLine(line: string, key: number) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <p key={key} className={line ? 'mt-0' : 'h-2'}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-semibold text-ink-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  )
}

/**
 * A scripted Nexa exchange that types itself out when it scrolls into view.
 *
 * It is decorative: `aria-hidden`, non-interactive, and it never claims to be
 * live. Users who prefer reduced motion get the finished conversation with no
 * typing at all.
 */
export function ChatPreview() {
  const container = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [started, setStarted] = useState(false)
  const [typedUser, setTypedUser] = useState('')
  const [typedReply, setTypedReply] = useState('')
  const [thinking, setThinking] = useState(false)

  const [user, assistant] = PREVIEW_TURNS

  // With reduced motion the finished conversation is shown outright — derived
  // rather than written into state, so there is nothing to synchronise.
  const userText = reducedMotion ? user.text : typedUser
  const replyText = reducedMotion ? assistant.text : typedReply

  // Only animate once the preview is actually on screen — typing that finishes
  // above the fold before anyone scrolls to it is wasted.
  useEffect(() => {
    const node = container.current
    if (!node || reducedMotion) return

    if (typeof IntersectionObserver === 'undefined') {
      // No observer (a very old browser): start on the next tick rather than
      // never, so the card is not left empty.
      const timer = setTimeout(() => setStarted(true), 0)
      return () => clearTimeout(timer)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion])

  useEffect(() => {
    if (!started) return

    const timers: ReturnType<typeof setTimeout>[] = []
    let index = 0

    const typeUser = () => {
      index += 1
      setTypedUser(user.text.slice(0, index))
      if (index < user.text.length) {
        timers.push(setTimeout(typeUser, 26))
      } else {
        timers.push(
          setTimeout(() => {
            setThinking(true)
            timers.push(setTimeout(startReply, 900))
          }, 380),
        )
      }
    }

    const startReply = () => {
      setThinking(false)
      let replyIndex = 0
      const typeReply = () => {
        // Several characters per tick: a reply that streams one letter at a
        // time reads slower than the real thing does.
        replyIndex = Math.min(replyIndex + 3, assistant.text.length)
        setTypedReply(assistant.text.slice(0, replyIndex))
        if (replyIndex < assistant.text.length) timers.push(setTimeout(typeReply, 16))
      }
      typeReply()
    }

    timers.push(setTimeout(typeUser, 260))
    return () => timers.forEach(clearTimeout)
  }, [started, user.text, assistant.text])

  const typingUser = started && userText.length < user.text.length

  return (
    <div
      ref={container}
      aria-hidden="true"
      className="relative mx-auto w-full max-w-3xl select-none"
    >
      {/* Soft green bloom behind the card, so it lifts off the page without a
          heavy shadow. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -top-8 bottom-0 -z-10 rounded-[3rem] bg-gradient-to-b from-brand-200/45 via-brand-100/25 to-transparent blur-2xl"
      />

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-raised shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-ink-200 bg-ink-50/70 px-4 py-3">
          <Logo size={22} href={null} />
          <span className="text-[13px] font-medium text-ink-700">Nexa</span>
          <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
            Balanced
          </span>
        </div>

        <div className="space-y-5 px-4 py-6 sm:px-6">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[14.5px] leading-relaxed text-white">
              {userText}
              {typingUser && <span className="ml-0.5 animate-blink">▍</span>}
            </div>
          </div>

          {(thinking || replyText) && (
            <div className="flex items-start gap-3">
              <Logo size={26} href={null} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink-700">
                {thinking ? (
                  <span className="inline-flex items-center gap-1 py-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 rounded-full bg-ink-400"
                        style={{ animation: 'var(--animate-dot)', animationDelay: `${dot * 0.15}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  <div className="space-y-2">
                    {replyText.split('\n').map((line, index) => renderLine(line, index))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-ink-200 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5">
            <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
            <span className="flex-1 truncate text-[14px] text-ink-400">Ask Nexa anything…</span>
            <span
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg text-white',
                'bg-brand-600',
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
