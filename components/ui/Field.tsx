'use client'

import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

const CONTROL =
  'block w-full rounded-md border-0 bg-raised px-3 py-2.5 text-[15px] text-ink-900 ' +
  'shadow-xs ring-1 ring-inset ring-ink-300 transition placeholder:text-ink-400 ' +
  'hover:ring-ink-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500'

const CONTROL_INVALID = 'ring-danger-icon hover:ring-danger-icon focus:ring-danger-icon'

interface FieldShellProps {
  label: string
  /** Rendered under the control when there is no error. */
  hint?: ReactNode
  error?: string | null
  /** Extra control on the label row, e.g. a "Forgot password?" link. */
  action?: ReactNode
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/**
 * Label, control, hint and error in one place, wired together with the ids
 * that screen readers need. Every form in the app uses this, so the
 * relationship is never forgotten on one page and present on another.
 */
export function Field({ label, hint, error, action, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {action}
      </div>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] text-danger-icon">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'className'> & {
  className?: string
  invalid?: boolean
}

export function Input({ className, invalid, ...rest }: InputProps) {
  return (
    <input
      className={cn(CONTROL, invalid && CONTROL_INVALID, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> & {
  className?: string
  invalid?: boolean
}

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(CONTROL, 'resize-y leading-relaxed', invalid && CONTROL_INVALID, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className'> & { className?: string }

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cn(CONTROL, 'pr-9', className)} {...rest}>
      {children}
    </select>
  )
}

/** A switch for boolean settings. Uses a real checkbox for keyboard and AT support. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] text-ink-500">{description}</p> : null}
      </div>

      <label
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-ink-300',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-raised shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </label>
    </div>
  )
}
