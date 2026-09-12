import 'server-only'

import { anthropicProvider } from './anthropic'
import { openrouterProvider } from './openrouter'
import type { AIProvider } from './types'

/**
 * The single place a provider is chosen. Adding one means implementing
 * `AIProvider` and adding it to this map — no route, component or database
 * code changes.
 */
const PROVIDERS: Record<string, AIProvider> = {
  openrouter: openrouterProvider,
  anthropic: anthropicProvider,
}

export const DEFAULT_PROVIDER = 'openrouter'

export function getProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? DEFAULT_PROVIDER
  const provider = PROVIDERS[name]
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}.`,
    )
  }
  return provider
}

/**
 * Which environment variable the active provider needs. Used by the startup
 * check to name the missing one precisely.
 */
const KEY_NAMES: Record<string, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

/**
 * Reports a missing credential once, at boot, instead of leaving the first
 * user to discover it. It prints the NAME of the variable only — never the
 * value, and never a prefix of it.
 */
export function reportProviderConfig(): void {
  const name = process.env.AI_PROVIDER ?? DEFAULT_PROVIDER
  const provider = PROVIDERS[name]

  if (!provider) {
    console.error(`[nexa] Unknown AI_PROVIDER "${name}".`)
    return
  }

  if (!provider.configured) {
    console.error(
      `[nexa] ${KEY_NAMES[name] ?? 'the provider API key'} is missing — ` +
        `chat requests will fail with 503 until it is set in .env.local`,
    )
    return
  }

  console.log(`[nexa] AI provider: ${name} (credential present)`)
}

export * from './models'
export * from './types'
