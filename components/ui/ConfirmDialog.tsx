'use client'

import { useEffect, useRef } from 'react'
import { Button } from './Button'

/**
 * A confirmation gate for destructive actions. Rendered as a real modal: focus
 * moves into it, Escape closes it, and the page behind cannot be scrolled.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  const confirmButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    confirmButton.current?.focus()
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onCancel, busy])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-night-900/45"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="animate-fade-in relative w-full max-w-md rounded-2xl bg-raised p-6 shadow-xl"
      >
        <h2 id="confirm-title" className="text-[17px] font-semibold text-ink-900">
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-[14.5px] leading-relaxed text-ink-600">
          {body}
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button ref={confirmButton} variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
