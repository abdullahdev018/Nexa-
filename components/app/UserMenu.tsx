'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut, Settings, User } from 'lucide-react'
import { useDismiss } from '@/lib/hooks/useDismiss'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { getPlan } from '@/lib/billing/plans'
import type { CurrentUser, WorkspaceSummary } from '@/lib/types'

function initials(user: CurrentUser): string {
  const source = user.name?.trim() || user.email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase()
}

export function UserMenu({
  user,
  workspace,
  onNavigate,
}: {
  user: CurrentUser
  workspace: WorkspaceSummary
  onNavigate?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  useDismiss(menu, open, () => setOpen(false))

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  function go() {
    setOpen(false)
    onNavigate?.()
  }

  return (
    <div ref={menu} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-xl border border-ink-200 bg-raised p-1 shadow-lg">
          <Link
            href="/account"
            onClick={go}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-700 hover:bg-ink-50"
          >
            <User className="h-4 w-4 text-ink-400" aria-hidden="true" />
            Account
          </Link>
          <Link
            href="/settings"
            onClick={go}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-700 hover:bg-ink-50"
          >
            <Settings className="h-4 w-4 text-ink-400" aria-hidden="true" />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setConfirmingLogout(true)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-700 hover:bg-ink-50"
          >
            <LogOut className="h-4 w-4 text-ink-400" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink-200/60"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-semibold text-white">
          {initials(user)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink-900">
            {user.name ?? user.email}
          </span>
          <span className="block truncate text-[12px] text-ink-500">
            {getPlan(workspace.plan).name} plan
          </span>
        </span>
      </button>

      {/* Portalled: the mobile sidebar drawer is transformed, which would trap a
          fixed-position dialog inside it. */}
      {confirmingLogout &&
        createPortal(
          <ConfirmDialog
            open
            title="Log out of Nexa?"
            body={`You'll be signed out as ${user.email} on this device. Anything you haven't saved will be lost, and you'll need your password to sign back in.`}
            confirmLabel={loggingOut ? 'Logging out…' : 'Log out'}
            busy={loggingOut}
            onConfirm={() => void logout()}
            onCancel={() => setConfirmingLogout(false)}
          />,
          document.body,
        )}
    </div>
  )
}
