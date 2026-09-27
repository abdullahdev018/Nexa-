import { planIncludes, type PlanId } from '@/lib/billing/plans'
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

/** A locked tier is still shown in the picker, but cannot be sent to. */
export function canUseModel(model: NexaModel, plan: PlanId): boolean {
  return planIncludes(plan, model.requiresPlan)
}
