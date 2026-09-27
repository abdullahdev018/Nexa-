import 'server-only'

import type { AIProvider, CompletionUsage } from './types'

export type GenerateResult =
  | { ok: true; text: string; usage?: CompletionUsage; model: string }
  | { ok: false; message: string; status: number; text: string; model: string }

/**
 * Runs one completion to the end and returns the whole reply.
 *
 * For generations whose output is parsed rather than shown as it arrives — a
 * campaign plan is useless until the JSON is complete. The caller decides what
 * to charge; this only reports what happened.
 */
export async function generateText(
  provider: AIProvider,
  options: { modelId: string; systemPrompt: string; prompt: string; signal?: AbortSignal },
): Promise<GenerateResult> {
  let text = ''
  let usage: CompletionUsage | undefined
  let model = options.modelId

  try {
    for await (const event of provider.stream({
      modelId: options.modelId,
      systemPrompt: options.systemPrompt,
      messages: [{ role: 'user', content: options.prompt }],
      signal: options.signal,
    })) {
      if (event.type === 'text') text += event.text
      else if (event.type === 'done') {
        usage = event.usage
        model = event.model
      } else if (event.type === 'error') {
        return { ok: false, message: event.message, status: event.status ?? 502, text, model }
      }
    }
  } catch (error) {
    console.error('[generate]', (error as Error)?.name ?? 'error')
    return { ok: false, message: 'The generation was interrupted.', status: 502, text, model }
  }

  if (!text.trim()) {
    return { ok: false, message: 'The model returned nothing.', status: 502, text, model }
  }
  return { ok: true, text, usage, model }
}
