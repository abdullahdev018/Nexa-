import 'server-only'

import { OpenRouter } from '@openrouter/sdk'
import {
  BadRequestResponseError,
  ForbiddenResponseError,
  InternalServerResponseError,
  NotFoundResponseError,
  PaymentRequiredResponseError,
  ProviderOverloadedResponseError,
  RequestTimeoutResponseError,
  ServiceUnavailableResponseError,
  TooManyRequestsResponseError,
  UnauthorizedResponseError,
} from '@openrouter/sdk/models/errors'
import { NEXA_MODELS } from './models'
import {
  ProviderError,
  type AIProvider,
  type ChatMessage,
  type CompletionEvent,
  type CompletionRequest,
} from './types'

/**
 * Maps Nexa's product tiers onto OpenRouter model slugs.
 *
 * The tier ids are what conversations and preferences store, so they stay
 * stable even when the model behind one is swapped. Override any of these with
 * an environment variable to change a tier without a deploy.
 */
interface TierConfig {
  model: string
  maxTokens: number
}

function tierFor(modelId: string): TierConfig {
  const tiers: Record<string, TierConfig> = {
    'nexa-swift': {
      model: process.env.OPENROUTER_MODEL_SWIFT ?? 'anthropic/claude-haiku-4.5',
      maxTokens: 8192,
    },
    'nexa-balanced': {
      model: process.env.OPENROUTER_MODEL_BALANCED ?? 'anthropic/claude-sonnet-4.5',
      maxTokens: 32000,
    },
    'nexa-deep': {
      model: process.env.OPENROUTER_MODEL_DEEP ?? 'anthropic/claude-opus-4.1',
      maxTokens: 32000,
    },
  }
  return tiers[modelId] ?? tiers['nexa-balanced']
}

/**
 * Turns a provider failure into something safe to show a user.
 *
 * The upstream message is deliberately discarded: it can echo request content
 * and, on a misconfiguration, parts of the credential. Only the class of
 * failure crosses this boundary.
 */
function describe(error: unknown): ProviderError {
  if (error instanceof UnauthorizedResponseError || error instanceof ForbiddenResponseError) {
    return new ProviderError('The AI provider rejected the server credentials.', 502)
  }
  if (error instanceof TooManyRequestsResponseError) {
    return new ProviderError('Nexa is busy right now. Try again in a moment.', 429)
  }
  if (error instanceof PaymentRequiredResponseError) {
    return new ProviderError('The AI provider account is out of credit.', 502)
  }
  if (error instanceof NotFoundResponseError) {
    return new ProviderError('That model is not available right now.', 502)
  }
  if (
    error instanceof ServiceUnavailableResponseError ||
    error instanceof ProviderOverloadedResponseError
  ) {
    return new ProviderError('The model is overloaded. Try again shortly.', 503)
  }
  if (error instanceof RequestTimeoutResponseError) {
    return new ProviderError('The model took too long to respond.', 504)
  }
  if (error instanceof BadRequestResponseError) {
    return new ProviderError('That request could not be processed.', 400)
  }
  if (error instanceof InternalServerResponseError) {
    return new ProviderError('The AI provider had an internal error.', 502)
  }
  if (error instanceof TypeError) {
    // fetch throws TypeError on DNS/connection failure.
    return new ProviderError('Could not reach the AI provider.', 504)
  }
  return new ProviderError('Something went wrong generating a reply.', 500)
}

/** Flattens Nexa's message shape into OpenRouter's content blocks. */
function toContent(message: ChatMessage) {
  const attachments = message.attachments ?? []
  if (attachments.length === 0) return message.content

  const parts: Array<
    { type: 'text'; text: string } | { type: 'image_url'; imageUrl: { url: string } }
  > = []

  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      // OpenRouter takes images as data URLs rather than raw base64.
      parts.push({
        type: 'image_url',
        imageUrl: { url: `data:${attachment.mediaType};base64,${attachment.data}` },
      })
    } else {
      parts.push({
        type: 'text',
        text: `Attached file "${attachment.name}":\n\n${attachment.data}`,
      })
    }
  }

  if (message.content.trim()) parts.push({ type: 'text', text: message.content })
  return parts
}

class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter'
  readonly models = NEXA_MODELS

  private client: OpenRouter | null = null

  get configured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY)
  }

  private getClient(): OpenRouter {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new ProviderError(
        'Nexa is not connected to an AI provider yet. Set OPENROUTER_API_KEY in the server environment.',
        503,
      )
    }

    // Built once and reused. The key is read from the environment here and
    // never logged, returned, or sent anywhere but OpenRouter.
    this.client ??= new OpenRouter({ apiKey })
    return this.client
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionEvent> {
    const tier = tierFor(request.modelId)
    const client = this.getClient()

    try {
      const response = await client.chat.send(
        {
          // Identifies the app in OpenRouter's dashboard and rankings.
          httpReferer: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
          appTitle: 'Nexa AI',
          chatRequest: {
            model: tier.model,
            maxTokens: tier.maxTokens,
            stream: true,
            messages: [
              { role: 'system', content: request.systemPrompt },
              ...request.messages.map((message) => ({
                role: message.role,
                content: toContent(message),
              })),
            ],
          },
        },
        { fetchOptions: { signal: request.signal } },
      )

      // Every `send` overload is typed as `ChatResult | EventStream`, so the
      // streaming response has to be narrowed before it can be iterated.
      if (!(Symbol.asyncIterator in response)) {
        throw new ProviderError('The AI provider did not return a stream.', 502)
      }
      const stream = response

      let usage: { inputTokens: number; outputTokens: number } | undefined
      let servedBy = tier.model

      for await (const chunk of stream) {
        // OpenRouter can report a mid-stream failure in the chunk itself
        // rather than by throwing.
        if (chunk.error) {
          yield { type: 'error', message: 'The model stopped part-way through.', status: 502 }
          return
        }

        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) yield { type: 'text', text: delta }

        if (chunk.model) servedBy = chunk.model
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.promptTokens ?? 0,
            outputTokens: chunk.usage.completionTokens ?? 0,
          }
        }
      }

      yield { type: 'done', model: servedBy, usage }
    } catch (error) {
      if (request.signal?.aborted) return

      const described = error instanceof ProviderError ? error : describe(error)
      // Logged as a class, never with the upstream body — that can carry the
      // request content and, on a misconfiguration, the credential.
      console.error(`[openrouter] ${(error as Error)?.name ?? 'error'}: ${described.message}`)
      yield { type: 'error', message: described.message, status: described.status }
    }
  }
}

export const openrouterProvider = new OpenRouterProvider()
