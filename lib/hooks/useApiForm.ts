'use client'

import { useCallback, useState } from 'react'

interface ApiErrorBody {
  error?: string
  fields?: Record<string, string>
}

export interface ApiFormState {
  submitting: boolean
  /** Message for the form-level banner. */
  error: string | null
  /** Per-field messages, keyed by the field name the API returned. */
  fields: Record<string, string>
}

/**
 * The submit half of every form in the app: one in-flight guard, one error
 * banner, and per-field messages parsed from the standard API error shape.
 */
export function useApiForm() {
  const [state, setState] = useState<ApiFormState>({
    submitting: false,
    error: null,
    fields: {},
  })

  /** Clears the message for one field as the user edits it. */
  const clearField = useCallback((name: string) => {
    setState((current) => {
      if (!current.fields[name] && !current.error) return current
      const fields = { ...current.fields }
      delete fields[name]
      return { ...current, fields, error: null }
    })
  }, [])

  const submit = useCallback(
    async <T,>(url: string, body: unknown, method = 'POST'): Promise<T | null> => {
      setState({ submitting: true, error: null, fields: {} })

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const payload = (await response.json().catch(() => ({}))) as ApiErrorBody & T

        if (!response.ok) {
          setState({
            submitting: false,
            error: payload.error ?? 'Something went wrong. Please try again.',
            fields: payload.fields ?? {},
          })
          return null
        }

        // Deliberately left submitting: the caller navigates next, and
        // re-enabling the button first causes a visible flicker.
        return payload
      } catch {
        setState({
          submitting: false,
          error: 'Could not reach the server. Check your connection and try again.',
          fields: {},
        })
        return null
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setState({ submitting: false, error: null, fields: {} })
  }, [])

  const stop = useCallback(() => {
    setState((current) => ({ ...current, submitting: false }))
  }, [])

  return { ...state, submit, clearField, reset, stop }
}
