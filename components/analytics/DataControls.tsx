'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FlaskConical, Trash2, Upload } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { CSV_COLUMNS, MAX_IMPORT_ROWS, parseImport } from '@/lib/analytics/metrics'

const SAMPLE = `date,platform,impressions,reach,clicks,leads,conversions,spend,currency
2026-09-20,Instagram,4200,3100,63,6,3,48.20,USD
2026-09-20,TikTok,9800,7400,121,9,4,61.00,USD`

/** Import a CSV from an ad manager, or paste rows. Previewed with the same parser the server uses. */
export function ImportButton({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const router = useRouter()
  const form = useApiForm()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [done, setDone] = useState<{ imported: number; skippedCount: number; warnings: string[] } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const preview = csv.trim() ? parseImport(csv) : null

  async function readFile(file: File | undefined) {
    if (!file) return
    if (file.size > 2_000_000) {
      setCsv('')
      setFileError('That file is over 2 MB. Export a shorter date range, or split it.')
      return
    }
    setFileError(null)
    setCsv(await file.text())
  }

  async function submit() {
    const result = await form.submit<{ imported: number; skippedCount: number; warnings: string[] }>('/api/analytics/import', { csv, campaignId })
    form.stop()
    if (!result) return
    setDone(result)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => { setDone(null); setCsv(''); form.reset(); setOpen(true) }}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        Import results
      </Button>
      <Modal open={open} title="Import your results" onClose={() => setOpen(false)} busy={form.submitting}>
        {done ? (
          <>
            <Alert tone="success">
              Imported {done.imported.toLocaleString()} row{done.imported === 1 ? '' : 's'}.
              {done.skippedCount > 0 && ` ${done.skippedCount} could not be read and were skipped.`}
              {done.warnings.length > 0 && ` ${done.warnings.length} were imported with a note — see below.`}
            </Alert>
            {done.warnings.length > 0 && (
              <ul className="mt-3 max-h-28 space-y-0.5 overflow-y-auto text-[13px] text-ink-600">
                {done.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </>
        ) : (
          <>
            {(form.error || fileError) && <Alert className="mb-4">{form.error ?? fileError}</Alert>}
            <p className="text-[13.5px] leading-relaxed text-ink-600">
              Export a report from Meta Ads Manager, Google Ads or TikTok Ads as CSV and bring it here. One row per day
              (per platform, if you like). Columns, in any order: <code className="text-[12.5px]">{CSV_COLUMNS.join(', ')}</code>. Only{' '}
              <code className="text-[12.5px]">date</code> is required; spend is in currency units.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Choose a CSV file"
                onChange={(e) => readFile(e.target.files?.[0])}
                className="block w-full text-[13px] text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-ink-800 hover:file:bg-ink-200"
              />
              <Field label="Or paste rows" hint={`Up to ${MAX_IMPORT_ROWS.toLocaleString()} rows.`}>
                {({ id, describedBy }) => (
                  <Textarea id={id} aria-describedby={describedBy} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={SAMPLE} className="font-mono text-[12.5px]" />
                )}
              </Field>
              {campaigns.length > 0 && (
                <Field label="These results are for" hint="Optional.">
                  {({ id, describedBy }) => (
                    <Select id={id} aria-describedby={describedBy} value={campaignId ?? ''} onChange={(e) => setCampaignId(e.target.value || null)}>
                      <option value="">No particular campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
            </div>
            {preview && (
              <div className="mt-4 rounded-lg bg-ink-50 p-3 text-[13px] ring-1 ring-ink-200">
                <p className="font-medium text-ink-800">
                  {preview.rows.length.toLocaleString()} row{preview.rows.length === 1 ? '' : 's'} ready to import
                  {preview.errors.length > 0 && `, ${preview.errors.length} will be skipped`}
                </p>
                {preview.errors.length + preview.warnings.length > 0 && (
                  <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-ink-600">
                    {preview.errors.slice(0, 20).map((error) => (
                      <li key={error}>Skipped — {error}</li>
                    ))}
                    {preview.warnings.slice(0, 20).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={form.submitting}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={form.submitting || !preview || preview.rows.length === 0}>
                {form.submitting ? <Spinner label="Importing" /> : 'Import'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

/** Load, refresh or remove demo data, and clear imported data. */
export function SourceActions({ view, hasImported, hasDemo }: { view: 'real' | 'demo'; hasImported: boolean; hasDemo: boolean }) {
  const router = useRouter()
  const form = useApiForm()
  const [confirm, setConfirm] = useState<'IMPORTED' | 'DEMO' | null>(null)

  async function loadDemo() {
    const result = await form.submit('/api/analytics/demo', {})
    form.stop()
    if (!result) return
    router.push('/analytics?view=demo')
    router.refresh()
  }

  async function clear(source: 'IMPORTED' | 'DEMO') {
    const result = await form.submit(`/api/analytics?source=${source}`, {}, 'DELETE')
    form.stop()
    setConfirm(null)
    if (!result) return
    router.push(source === 'DEMO' ? '/analytics' : '/analytics?view=real')
    router.refresh()
  }

  return (
    <>
      {form.error && <p className="text-[13px] text-danger-icon">{form.error}</p>}
      {view === 'demo' ? (
        <>
          <Button size="sm" variant="secondary" onClick={loadDemo} disabled={form.submitting}>
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            {hasDemo ? 'Refresh demo data' : 'Load demo data'}
          </Button>
          {hasDemo && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm('DEMO')} disabled={form.submitting}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove demo data
            </Button>
          )}
        </>
      ) : (
        hasImported && (
          <Button size="sm" variant="ghost" onClick={() => setConfirm('IMPORTED')} disabled={form.submitting}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear imported data
          </Button>
        )
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'DEMO' ? 'Remove demo data?' : 'Clear all imported data?'}
        body={
          confirm === 'DEMO'
            ? 'The sample numbers are removed. Your own data is not touched.'
            : 'Every row you imported is deleted. Demo data is not touched. This cannot be undone.'
        }
        confirmLabel={confirm === 'DEMO' ? 'Remove' : 'Clear imported data'}
        onConfirm={() => confirm && clear(confirm)}
        onCancel={() => setConfirm(null)}
        busy={form.submitting}
      />
    </>
  )
}
