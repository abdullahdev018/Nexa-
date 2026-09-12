import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { NEXA_MODELS } from './models'
import {
  IMAGE_TYPES,
  ProviderError,
  type AIProvider,
  type ChatMessage,
  type CompletionEvent,
  type CompletionRequest,
  type ImageMediaType,
} from './types'

/**
 * Maps Nexa's product tiers onto real Claude models.
 *
 * Model ids are exact strings and never take a date suffix. Per-tier notes:
 *  - Haiku 4.5 does not accept adaptive thinking or an effort level.
 *  - Sonnet 5 and Opus 5 use adaptive thinking; `display: "summarized"` is
 *    omitted because Nexa does not surface reasoning in the UI, and leaving it
 *    off avoids paying to stream text nobody reads.
 *  - Opus 5 opts into server-side refusal fallbacks, so a policy decline is
 *    retried on another model inside the same request instead of dead-ending.
 */
interface TierConfig {
  model: string
  maxTokens: number
  adaptiveThinking: boolean
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  refusalFallbacks: boolean
}

const TIERS: Record<string, TierConfig> = {
  'nexa-swift': {
    model: 'claude-haiku-4-5',
    maxTokens: 8192,
    adaptiveThinking: false,
    refusalFallbacks: false,
  },
  'nexa-balanced': {
    model: 'claude-sonnet-5',
    maxTokens: 32000,
    adaptiveThinking: true,
    effort: 'medium',
    refusalFallbacks: false,
  },
  'nexa-deep': {
    model: 'claude-opus-5',
    maxTokens: 64000,
    adaptiveThinking: true,
    effort: 'high',
    refusalFallbacks: true,
  },
}

function tierFor(modelId: string): TierConfig {
  return TIERS[modelId] ?? TIERS['nexa-balanced']
}

/**
 * Builds the provider's content blocks. Attachments are rebuilt rather than
 * forwarded, so a malformed or hostile payload cannot reach the API as-is.
 */
function toContent(message: ChatMessage): Anthropic.ContentBlockParam[] | string {
  const attachments = message.attachments ?? []
  if (attachments.length === 0) return message.content

  const blocks: Anthropic.ContentBlockParam[] = []

  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      if (!IMAGE_TYPES.includes(attachment.mediaType as ImageMediaType)) continue
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mediaType as ImageMediaType,
          data: attachment.data,
        },
      })
    } else {
      // Named and fenced so the model can tell the file apart from the
      // question asked about it.
      blocks.push({
        type: 'text',
        text: `Attached file "${attachment.name}":\n\n${attachment.data}`,
      })
    }
  }

  if (message.content.trim()) blocks.push({ type: 'text', text: message.content })
  return blocks.length > 0 ? blocks : message.content
}

/** Translates an SDK error into a message worth showing a user. */
function describe(error: unknown): ProviderError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError('The AI provider rejected the server credentials.', 502)
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('Nexa is busy right now. Try again in a moment.', 429)
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ProviderError(`That request could not be processed: ${error.message}`, 400)
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('Could not reach the AI provider.', 504)
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError(`AI provider error (${error.status}).`, 502)
  }
  return new ProviderError('Something went wrong generating a reply.', 500)
}

class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'
  readonly models = NEXA_MODELS

  // The zero-argument constructor resolves ANTHROPIC_API_KEY or
  // ANTHROPIC_AUTH_TOKEN from the environment. It is only constructed when a
  // credential exists, so an unconfigured deployment fails loudly at the route
  // rather than on the first token.
  private client: Anthropic | null = null

  get configured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  }

  private getClient(): Anthropic {
    if (!this.configured) {
      throw new ProviderError(
        'No AI provider is configured. Set ANTHROPIC_API_KEY in the server environment.',
        503,
      )
    }
    this.client ??= new Anthropic()
    return this.client
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionEvent> {
    const tier = tierFor(request.modelId)
    const client = this.getClient()

    const params: Anthropic.MessageCreateParamsStreaming = {
      model: tier.model,
      max_tokens: tier.maxTokens,
      system: request.systemPrompt,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: toContent(message),
      })),
      stream: true,
    }

    if (tier.adaptiveThinking) params.thinking = { type: 'adaptive' }
    if (tier.effort) params.output_config = { effort: tier.effort }

    try {
      const stream = tier.refusalFallbacks
        ? client.beta.messages.stream(
            {
              ...params,
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default',
            } as Anthropic.Beta.MessageCreateParamsStreaming,
            { signal: request.signal },
          )
        : client.messages.stream(params, { signal: request.signal })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text }
        }
      }

      const final = await stream.finalMessage()

      // A refusal that survived the fallback chain is reported rather than
      // shown as an empty reply.
      if (final.stop_reason === 'refusal') {
        yield {
          type: 'error',
          message: 'Nexa could not help with that request.',
          status: 200,
        }
        return
      }

      yield {
        type: 'done',
        model: final.model,
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
      }
    } catch (error) {
      if (request.signal?.aborted) return
      const described = error instanceof ProviderError ? error : describe(error)
      yield { type: 'error', message: described.message, status: described.status }
    }
  }
}

export const anthropicProvider = new AnthropicProvider()
