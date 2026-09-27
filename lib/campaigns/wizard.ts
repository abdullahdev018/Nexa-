import type { CampaignGoal, CampaignStyle, Platform } from './options'

/**
 * The brief wizard's form state. Kept out of the client component so server
 * pages can build the initial values for it.
 */
export interface WizardValues {
  name: string
  brandId: string | null
  /** 'new' means the product is described in `product` below. */
  productId: string | 'new'
  product: { name: string; description: string; category: string; price: string }
  goal: CampaignGoal | null
  style: CampaignStyle | null
  platforms: Platform[]
  audienceAgeRange: string
  audienceLocation: string
  audienceInterests: string[]
  audienceCustomerType: string
  audiencePainPoints: string
}

export function emptyWizardValues(brandId: string | null, productId: string | null): WizardValues {
  return {
    name: '',
    brandId,
    productId: productId ?? 'new',
    product: { name: '', description: '', category: '', price: '' },
    goal: null,
    style: null,
    platforms: [],
    audienceAgeRange: '',
    audienceLocation: '',
    audienceInterests: [],
    audienceCustomerType: '',
    audiencePainPoints: '',
  }
}
