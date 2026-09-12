'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Closes a popover on Escape or a click outside it. Both are wired here so no
 * menu in the app ends up with only one of the two.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const node = ref.current
      if (node && !node.contains(event.target as Node)) onClose()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    // `mousedown` rather than `click`: closing on press feels immediate, and
    // avoids the menu re-opening from the same click that opened it.
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, open, onClose])
}
