/**
 * The seam between Nexa and whichever model provider is configured.
 *
 * Everything above this file — API routes, the chat UI, conversation storage —
 * speaks only in these types. Swapping provider means writing one new
 * `AIProvider` and changing the entry in `registry.ts`; nothing else moves.
 */

export type ChatRole = 'user' | 'assistant'
import type { PlanId } from '@/lib/billing/plans'


/** Accepted image types. Anything else is rejected before it reaches a provider. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
export type ImageMediaType = (typeof IMAGE_TYPES)[number]

/**
 * A file the user attached. Images travel as base64 and become vision blocks;
 * everything else is read as text and inlined, which is what makes "file
 * analysis" work for code, CSV, JSON and markdown without a parsing service.
 */
export interface Attachment {
  name: string
  kind: 'image' | 'text'
  /** Base64 for images, plain text otherwise. */
  data: string
  mediaType: string
  size: number
}

export interface ChatMessage {
  role: ChatRole
  content: string
  attachments?: Attachment[]
}

/** A Nexa-facing model tier, mapped onto a real provider model in the adapter. */
export interface NexaModel {
  /** Stable id stored on conversations and preferences, e.g. "nexa-balanced". */
  id: string
  name: string
  description: string
  /** Shown on the model picker as a rough speed/depth hint. */
  badge: string
  /** Tiers above the workspace's plan are visible but locked. */
  requiresPlan: PlanId
}

export interface CompletionRequest {
  modelId: string
  messages: ChatMessage[]
  /** Assembled by the caller from the user's role, use cases and preferences. */
  systemPrompt: string
  signal?: AbortSignal
}

export interface CompletionUsage {
  inputTokens: number
  outputTokens: number
}

/** What a provider streams back. `text` chunks arrive in order. */
export type CompletionEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; usage?: CompletionUsage; model: string }
  | { type: 'error'; message: string; status?: number }

export interface AIProvider {
  /** Identifier for logs and the health endpoint, e.g. "anthropic". */
  readonly name: string
  /** False when the provider has no credentials; the UI says so plainly. */
  readonly configured: boolean
  readonly models: NexaModel[]
  stream(request: CompletionRequest): AsyncIterable<CompletionEvent>
}

/** Raised by a provider for a cause worth showing the user verbatim. */
export class ProviderError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
  }
}
