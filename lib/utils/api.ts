import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/** Uniform JSON error shape, so the client only ever parses one thing. */
export function apiError(message: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, fields }, { status })
}

/** Turns a Zod failure into per-field messages the forms can render inline. */
export function validationError(error: ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    fields[key] ??= issue.message
  }
  return apiError('Please check the highlighted fields.', 422, fields)
}

/** Parses a JSON body, returning null rather than throwing on malformed input. */
export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
