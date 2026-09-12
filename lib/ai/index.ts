import 'server-only'

import { anthropicProvider } from './anthropic'
import type { AIProvider } from './types'

/**
 * The single place a provider is chosen. Adding one means implementing
 * `AIProvider` and adding it to this map — no route, component or database
 * code changes.
 */
const PROVIDERS: Record<string, AIProvider> = {
  anthropic: anthropicProvider,
}

export function getProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? 'anthropic'
  const provider = PROVIDERS[name]
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}.`,
    )
  }
  return provider
}

export * from './models'
export * from './types'
