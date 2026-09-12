'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * Reads the user's motion preference.
 *
 * `useSyncExternalStore` rather than an effect: matchMedia is an external
 * store, and this gets the server snapshot (no preference) and the tearing-free
 * client subscription for free, without a setState-in-effect round trip.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // Server render: assume motion is fine, then correct on hydration.
    () => false,
  )
}
