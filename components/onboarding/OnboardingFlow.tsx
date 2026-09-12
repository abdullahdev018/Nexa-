'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Logo } from '@/components/ui/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { NEXA_MODELS, DEFAULT_MODEL_ID } from '@/lib/ai/models'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { cn } from '@/lib/utils/cn'

const ROLE_SUGGESTIONS = [
  'Software engineer',
  'Product manager',
  'Designer',
  'Marketer',
  'Founder',
  'Student',
  'Researcher',
  'Writer',
]

const USE_CASES = [
  'Writing and editing',
  'Coding and debugging',
  'Research and summarising',
  'Data and analysis',
  'Planning and strategy',
  'Learning something new',
  'Customer communication',
  'Brainstorming ideas',
]

const STEPS = ['About you', 'What you need', 'How Nexa thinks'] as const

export function OnboardingFlow({ name }: { name: string | null }) {
  const router = useRouter()
  const form = useApiForm()

  const [step, setStep] = useState(0)
  const [role, setRole] = useState('')
  const [useCases, setUseCases] = useState<string[]>([])
  const [model, setModel] = useState(DEFAULT_MODEL_ID)

  const canContinue = step === 0 ? role.trim().length > 0 : true

  function toggleUseCase(value: string) {
    setUseCases((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  async function finish() {
    const result = await form.submit<{ next: string }>('/api/user/onboarding', {
      role: role.trim(),
      useCases,
      defaultModel: model,
    })
    if (!result) return
    router.replace(result.next)
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 py-10 sm:px-8">
      <Logo size={32} withWordmark href={null} />

      {/* Progress is shown as labelled segments rather than a bare bar, so the
          user can see what is still to come. */}
      <ol className="mt-10 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <span
              className={cn(
                'h-1 rounded-full transition-colors',
                index <= step ? 'bg-brand-600' : 'bg-ink-200',
              )}
            />
            <span
              className={cn(
                'text-[12.5px] font-medium',
                index === step ? 'text-ink-800' : 'text-ink-400',
              )}
              aria-current={index === step ? 'step' : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex-1">
        {form.error && <Alert className="mb-6">{form.error}</Alert>}

        {step === 0 && (
          <div className="animate-fade-in">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink-900">
              {name ? `Welcome, ${name.split(' ')[0]}.` : 'Welcome to Nexa.'}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
              Tell Nexa what you do, and it will pitch answers correctly from the first message
              instead of guessing.
            </p>

            <div className="mt-8">
              <Field label="What do you do?" error={form.fields.role}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    value={role}
                    onChange={(event) => {
                      setRole(event.target.value)
                      form.clearField('role')
                    }}
                    placeholder="e.g. Backend engineer at a fintech startup"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    autoFocus
                  />
                )}
              </Field>

              <div className="mt-4 flex flex-wrap gap-2">
                {ROLE_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setRole(suggestion)}
                    className="rounded-full border border-ink-200 bg-raised px-3 py-1.5 text-[13px] text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink-900">
              What do you want help with?
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
              Pick as many as apply, or none — you can change this later in Settings.
            </p>

            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {USE_CASES.map((useCase) => {
                const selected = useCases.includes(useCase)
                return (
                  <button
                    key={useCase}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleUseCase(useCase)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors',
                      selected
                        ? 'border-brand-600 bg-brand-50 text-brand-900'
                        : 'border-ink-200 bg-raised text-ink-700 hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    {useCase}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300',
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink-900">
              How hard should Nexa think?
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
              This is only a default — you can switch models in any conversation.
            </p>

            <div className="mt-8 space-y-3">
              {NEXA_MODELS.map((option) => {
                const selected = model === option.id
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors',
                      selected
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-ink-200 bg-raised hover:border-ink-300 hover:bg-ink-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={option.id}
                      checked={selected}
                      onChange={() => setModel(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        selected ? 'border-brand-600' : 'border-ink-300',
                      )}
                      style={{ height: 18, width: 18 }}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                    </span>

                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-ink-900">{option.name}</span>
                        <span className="rounded-full bg-raised px-2 py-0.5 text-[11.5px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200">
                          {option.badge}
                        </span>
                        {option.requiresPlan === 'PRO' && (
                          <span className="rounded-full bg-night-900 px-2 py-0.5 text-[11.5px] font-medium text-white">
                            Pro
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-ink-600">
                        {option.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-ink-200 pt-6">
        <Button
          variant="ghost"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || form.submitting}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            size="lg"
            onClick={() => setStep((current) => current + 1)}
            disabled={!canContinue}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="lg" onClick={finish} disabled={form.submitting}>
            {form.submitting ? <Spinner label="Finishing setup" /> : 'Start using Nexa'}
          </Button>
        )}
      </div>
    </div>
  )
}
