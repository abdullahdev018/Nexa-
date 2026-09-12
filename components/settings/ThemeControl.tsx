'use client'

import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { applyTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'

const OPTIONS: { value: Theme; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'LIGHT', label: 'Light', description: 'Always light', icon: Sun },
  { value: 'DARK', label: 'Dark', description: 'Always dark', icon: Moon },
  { value: 'SYSTEM', label: 'System', description: 'Match your device', icon: Monitor },
]

/** A miniature of the app, painted in the colours the option would produce. */
function Preview({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="block overflow-hidden rounded-md ring-1 ring-inset"
      style={{
        // Literal colours, not theme tokens: each swatch must show its own
        // theme regardless of which one is currently active.
        backgroundColor: dark ? '#0b1220' : '#ffffff',
        boxShadow: `inset 0 0 0 1px ${dark ? '#243045' : '#e4e7ec'}`,
      }}
    >
      <span className="flex h-14 w-full">
        <span
          className="h-full w-1/3 border-r"
          style={{
            backgroundColor: dark ? '#1a2436' : '#f2f4f7',
            borderColor: dark ? '#243045' : '#e4e7ec',
          }}
        />
        <span className="flex h-full flex-1 flex-col justify-center gap-1.5 px-2">
          <span
            className="block h-1.5 w-3/4 rounded-full"
            style={{ backgroundColor: dark ? '#32405a' : '#e4e7ec' }}
          />
          <span
            className="block h-1.5 w-1/2 rounded-full"
            style={{ backgroundColor: dark ? '#32405a' : '#e4e7ec' }}
          />
          <span
            className="mt-0.5 block h-2 w-10 rounded-full"
            style={{ backgroundColor: dark ? '#2a9bf5' : '#0b74e0' }}
          />
        </span>
      </span>
    </span>
  )
}

export function ThemeControl({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systemDark, setSystemDark] = useState(false)

  // Only used to draw the System swatch correctly; read after mount so the
  // server and client render the same thing.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setSystemDark(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  // On SYSTEM, follow the OS while the page is open rather than only at load.
  useEffect(() => {
    if (theme !== 'SYSTEM') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme('SYSTEM')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  async function choose(next: Theme) {
    if (next === theme) return

    const previous = theme
    // Applied first: the whole point of a theme control is that it responds
    // immediately, not after a round trip.
    setTheme(next)
    applyTheme(next)
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      })
      if (!response.ok) throw new Error('save failed')
    } catch {
      // Roll back so the screen never disagrees with what was actually stored.
      setTheme(previous)
      applyTheme(previous)
      setError('Your theme could not be saved. It has been changed back.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && <Alert className="mb-5">{error}</Alert>}

      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid gap-3 sm:grid-cols-3"
      >
        {OPTIONS.map((option) => {
          const selected = option.value === theme
          const dark = option.value === 'DARK' || (option.value === 'SYSTEM' && systemDark)

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(option.value)}
              className={cn(
                'rounded-xl border p-2.5 text-left transition-colors',
                selected
                  ? 'border-brand-600 ring-1 ring-brand-600'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
              )}
            >
              <Preview dark={dark} />

              <span className="mt-2.5 flex items-center gap-1.5 px-0.5">
                <option.icon
                  className={cn('h-3.5 w-3.5', selected ? 'text-brand-600' : 'text-ink-400')}
                  aria-hidden="true"
                />
                <span className="text-[13.5px] font-medium text-ink-900">{option.label}</span>
                {selected && (
                  <Check className="ml-auto h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                )}
              </span>
              <span className="mt-0.5 block px-0.5 text-[12.5px] text-ink-500">
                {option.description}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex h-4 items-center gap-1.5 text-[12.5px] text-ink-500">
        {saving ? (
          <>
            <Spinner className="h-3 w-3" />
            Saving…
          </>
        ) : null}
      </p>
    </div>
  )
}
