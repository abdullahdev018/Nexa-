'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Check, Copy, Download, Pencil, Plus, RefreshCw, Trash2, VideoOff, X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { planToText, voiceoverScript, type Scene, type VideoPlan } from '@/lib/video/plan'

function stamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * A video plan: read it, copy it, edit it, rewrite it. The banner at the top
 * says plainly that no video was rendered — the plan is the deliverable.
 */
export function VideoPlanView({
  videoId,
  plan,
  renderExplanation,
  canRegenerate,
  cost,
}: {
  videoId: string
  plan: VideoPlan
  renderExplanation: string
  /** False when the plan no longer includes video; editing stays allowed. */
  canRegenerate: boolean
  cost: number
}) {
  const router = useRouter()
  const form = useApiForm()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(plan)
  const [copied, setCopied] = useState<'plan' | 'script' | null>(null)
  const [confirm, setConfirm] = useState<'regenerate' | 'delete' | null>(null)

  async function copy(kind: 'plan' | 'script') {
    try {
      await navigator.clipboard.writeText(kind === 'plan' ? planToText(plan) : voiceoverScript(plan))
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard can be blocked; nothing to recover.
    }
  }

  function download() {
    const blob = new Blob([planToText(plan)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${plan.title.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'video-plan'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function save() {
    const result = await form.submit(`/api/videos/${videoId}`, { plan: draft }, 'PATCH')
    form.stop()
    if (!result) return
    setEditing(false)
    router.refresh()
  }

  async function regenerate() {
    setConfirm(null)
    const result = await form.submit(`/api/videos/${videoId}/regenerate`, {})
    form.stop()
    if (result) router.refresh()
  }

  async function remove() {
    const result = await form.submit(`/api/videos/${videoId}`, {}, 'DELETE')
    if (!result) {
      form.stop()
      setConfirm(null)
      return
    }
    router.push('/video')
    router.refresh()
  }

  function setScene(index: number, patch: Partial<Scene>) {
    setDraft((current) => ({
      ...current,
      scenes: current.scenes.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)),
    }))
  }

  function addScene() {
    setDraft((current) => {
      const last = current.scenes.at(-1)
      const start = last?.end ?? 0
      // Timings are re-balanced by the server on save; this only keeps order.
      return {
        ...current,
        scenes: [
          ...current.scenes,
          { start, end: start + 3, shot: '', visual: '', onScreenText: null, voiceover: null, sound: null },
        ],
      }
    })
  }

  const busy = form.submitting

  return (
    <div>
      <div className="mb-6 flex items-start gap-3 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200">
        <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
        <p className="text-[13.5px] leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Plan only — no video was rendered.</span> {renderExplanation}
        </p>
      </div>

      {form.error && <Alert className="mb-6">{form.error}</Alert>}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? <Spinner label="Saving" /> : 'Save plan'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(plan)
                setEditing(false)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => copy('plan')}>
              {copied === 'plan' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              Copy plan
            </Button>
            <Button size="sm" variant="secondary" onClick={() => copy('script')}>
              {copied === 'script' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              Copy voiceover
            </Button>
            <Button size="sm" variant="secondary" onClick={download}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download .txt
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraft(plan)
                setEditing(true)
              }}
              disabled={busy}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
            {canRegenerate && (
              <Button size="sm" variant="secondary" onClick={() => setConfirm('regenerate')} disabled={busy}>
                {busy ? <Spinner className="h-3.5 w-3.5" label="Rewriting" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                Rewrite plan · {cost}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-danger-icon hover:text-danger-text"
              onClick={() => setConfirm('delete')}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-6">
          <Block title="Title">
            <Input aria-label="Title" maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Block>
          <Block title="Hook — first two seconds">
            <div className="space-y-2">
              <EditLine label="Line" value={draft.hook.line} max={300} onChange={(v) => setDraft({ ...draft, hook: { ...draft.hook, line: v } })} />
              <EditLine label="Visual" value={draft.hook.visual} max={400} onChange={(v) => setDraft({ ...draft, hook: { ...draft.hook, visual: v } })} />
              <EditLine label="On screen" value={draft.hook.onScreenText ?? ''} max={200} onChange={(v) => setDraft({ ...draft, hook: { ...draft.hook, onScreenText: v || null } })} />
            </div>
          </Block>
          <Block title="Scenes" description="Timings are re-balanced to the video's length when you save.">
            <ol className="space-y-3">
              {draft.scenes.map((scene, index) => (
                <li key={index} className="rounded-xl border border-ink-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-ink-500">Scene {index + 1}</span>
                    {draft.scenes.length > 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5"
                        aria-label={`Remove scene ${index + 1}`}
                        onClick={() => setDraft({ ...draft, scenes: draft.scenes.filter((_, i) => i !== index) })}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <EditLine label="Shot" value={scene.shot} max={200} onChange={(v) => setScene(index, { shot: v })} />
                    <EditLine label="Visual" value={scene.visual} max={600} multiline onChange={(v) => setScene(index, { visual: v })} />
                    <EditLine label="On screen" value={scene.onScreenText ?? ''} max={200} onChange={(v) => setScene(index, { onScreenText: v || null })} />
                    <EditLine label="Voiceover" value={scene.voiceover ?? ''} max={600} multiline onChange={(v) => setScene(index, { voiceover: v || null })} />
                    <EditLine label="Sound" value={scene.sound ?? ''} max={200} onChange={(v) => setScene(index, { sound: v || null })} />
                  </div>
                </li>
              ))}
            </ol>
            {draft.scenes.length < 20 && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={addScene}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add scene
              </Button>
            )}
          </Block>
          <Block title="Call to action">
            <div className="space-y-2">
              <EditLine label="Line" value={draft.cta.line} max={200} onChange={(v) => setDraft({ ...draft, cta: { ...draft.cta, line: v } })} />
              <EditLine label="On screen" value={draft.cta.onScreenText ?? ''} max={200} onChange={(v) => setDraft({ ...draft, cta: { ...draft.cta, onScreenText: v || null } })} />
            </div>
          </Block>
          <Block title="Production">
            <div className="space-y-2">
              <EditLine label="Music" value={draft.music ?? ''} max={300} onChange={(v) => setDraft({ ...draft, music: v || null })} />
              <EditLine label="Thumbnail" value={draft.thumbnail ?? ''} max={300} onChange={(v) => setDraft({ ...draft, thumbnail: v || null })} />
              <EditLine
                label="Shot list (one per line)"
                value={draft.shotList.join('\n')}
                max={5000}
                multiline
                onChange={(v) => setDraft({ ...draft, shotList: v.split('\n') })}
              />
              <EditLine label="Caption" value={draft.caption ?? ''} max={2200} multiline onChange={(v) => setDraft({ ...draft, caption: v || null })} />
            </div>
          </Block>
          {Object.keys(form.fields).length > 0 && (
            <p className="text-[13px] text-danger-icon">Some fields are empty or too long — every scene needs a shot and a visual.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Block title="Hook — first two seconds">
            <p className="text-[16px] font-semibold text-ink-900">&ldquo;{plan.hook.line}&rdquo;</p>
            <Detail label="Visual">{plan.hook.visual}</Detail>
            <Detail label="On screen">{plan.hook.onScreenText}</Detail>
          </Block>

          <Block title="Scenes">
            <ol className="relative space-y-3">
              {plan.scenes.map((scene, index) => (
                <li key={index} className="grid gap-3 rounded-xl border border-ink-200 p-4 sm:grid-cols-[5.5rem_1fr]">
                  <div>
                    <p className="font-mono text-[13px] font-medium tabular-nums text-ink-900">
                      {stamp(scene.start)}–{stamp(scene.end)}
                    </p>
                    <p className="text-[12px] text-ink-500">Scene {index + 1}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium uppercase tracking-wide text-ink-500">{scene.shot}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-800">{scene.visual}</p>
                    <Detail label="On screen">{scene.onScreenText}</Detail>
                    <Detail label="Voiceover">{scene.voiceover}</Detail>
                    <Detail label="Sound">{scene.sound}</Detail>
                  </div>
                </li>
              ))}
            </ol>
          </Block>

          <Block title="Call to action">
            <p className="text-[15px] font-semibold text-ink-900">{plan.cta.line}</p>
            <Detail label="On screen">{plan.cta.onScreenText}</Detail>
          </Block>

          <div className="grid gap-6 md:grid-cols-2">
            {plan.shotList.length > 0 && (
              <Block title="Shot list" description="Everything to capture on the day.">
                <ul className="space-y-1.5">
                  {plan.shotList.map((shot) => (
                    <li key={shot} className="flex gap-2 text-[14px] text-ink-700">
                      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                      {shot}
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            <Block title="Production notes">
              <Detail label="Music">{plan.music}</Detail>
              <Detail label="Thumbnail">{plan.thumbnail}</Detail>
              <Detail label="Caption">{plan.caption}</Detail>
            </Block>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Rewrite the whole plan?"
        body={`Nexa writes a new, different plan and replaces this one, including your edits. It costs ${cost} credits, charged only if it succeeds.`}
        confirmLabel="Rewrite"
        onConfirm={regenerate}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this video plan?"
        body="The plan is deleted. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
        busy={busy}
      />
    </div>
  )
}

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-raised p-5 shadow-xs">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Detail({ label, children }: { label: string; children: string | null }) {
  if (!children) return null
  return (
    <p className="mt-1.5 text-[13.5px] text-ink-700">
      <span className="font-medium text-ink-500">{label}:</span> {children}
    </p>
  )
}

function EditLine({
  label,
  value,
  max,
  multiline,
  onChange,
}: {
  label: string
  value: string
  max: number
  multiline?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink-600">{label}</span>
      {multiline ? (
        <Textarea rows={2} maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  )
}
