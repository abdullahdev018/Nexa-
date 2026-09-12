import type { NexaModel } from './types'

/**
 * The three tiers Nexa exposes. These ids are what conversations and
 * preferences store, so they must stay stable even if the provider behind
 * them changes.
 */
export const NEXA_MODELS: NexaModel[] = [
  {
    id: 'nexa-swift',
    name: 'Nexa Swift',
    description: 'Fastest replies. Best for quick questions and short back-and-forth.',
    badge: 'Fastest',
    requiresPlan: 'FREE',
  },
  {
    id: 'nexa-balanced',
    name: 'Nexa Balanced',
    description: 'The default. Strong reasoning at a sensible speed for most work.',
    badge: 'Recommended',
    requiresPlan: 'FREE',
  },
  {
    id: 'nexa-deep',
    name: 'Nexa Deep',
    description: 'Takes longer and thinks harder. For analysis, long documents and hard code.',
    badge: 'Most capable',
    requiresPlan: 'PRO',
  },
]

export const DEFAULT_MODEL_ID = 'nexa-balanced'

export function getModel(id: string | null | undefined): NexaModel {
  return NEXA_MODELS.find((model) => model.id === id) ?? NEXA_MODELS[1]
}

/** Free accounts may select a Pro tier in the UI, but not actually send to it. */
export function canUseModel(model: NexaModel, plan: 'FREE' | 'PRO' | 'TEAM'): boolean {
  return model.requiresPlan === 'FREE' || plan !== 'FREE'
}
