'use client'

import { useState } from 'react'
import { Lightbulb, Sparkles } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import type { Insights } from '@/lib/analytics/insights'

/**
 * Nexa Insights on the numbers on screen. Not stored: the result is for
 * reading now, and running it again on newer numbers is the point.
 */
export function InsightsPanel({
  range,
  campaignId,
  cost,
  balance,
}: {
  range: string
  campaignId: string | null
  cost: number
  balance: number
}) {
  const form = useApiForm()
  const [insights, setInsights] = useState<Insights | null>(null)

  async function run() {
    const result = await form.submit<{ insights: Insights }>('/api/analytics/insights', { range, campaignId })
    form.stop()
    if (result) setInsights(result.insights)
  }

  return (
    <section aria-labelledby="insights-heading" className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="insights-heading" className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <Lightbulb className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Nexa Insights
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-600">What these numbers say, and what to do next. Uses only the figures on this page.</p>
        </div>
        <Button size="sm" onClick={run} disabled={form.submitting || balance < cost}>
          {form.submitting ? (
            <>
              <Spinner label="Reading" />
              Reading…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {insights ? 'Read again' : 'Get insights'} · {cost}
            </>
          )}
        </Button>
      </div>

      {form.error && <Alert className="mt-4">{form.error}</Alert>}

      {insights && (
        <div className="mt-5 space-y-5">
          <p className="text-[14.5px] leading-relaxed text-ink-800">{insights.summary}</p>
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">What stands out</h3>
            <ul className="mt-2 space-y-2">
              {insights.findings.map((finding) => (
                <li key={finding.title} className="rounded-lg bg-ink-50 p-3 ring-1 ring-ink-200">
                  <p className="text-[14px] font-medium text-ink-900">{finding.title}</p>
                  <p className="mt-0.5 text-[13.5px] text-ink-700">{finding.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">What to do next</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-ink-800">
              {insights.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
