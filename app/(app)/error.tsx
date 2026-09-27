'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'

/**
 * Catches an unexpected failure inside the app shell, so the sidebar stays and
 * only the page that broke is replaced. The error's message is not shown — in
 * production it is scrubbed anyway, and it can carry server details — only its
 * digest, which matches the server log line.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[app] page failed', error.digest ?? error.name)
  }, [error])

  return (
    <div className="flex h-full items-center justify-center px-5 py-16">
      <div role="alert" className="max-w-md text-center">
        <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl bg-danger-surface text-danger-icon">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-ink-900">This page could not load</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-600">
          Something went wrong on our side. Nothing you saved has been lost, and no credits were charged for it.
        </p>
        {error.digest && <p className="mt-2 text-[12px] text-ink-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <LinkButton href="/dashboard" variant="secondary">
            Go to dashboard
          </LinkButton>
        </div>
      </div>
    </div>
  )
}
