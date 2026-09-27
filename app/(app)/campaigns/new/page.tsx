import type { Metadata } from 'next'
import { requireWorkspace } from '@/lib/auth/workspace'
import { creditCost } from '@/lib/billing/plans'
import { loadWizardData } from '@/lib/campaigns/queries'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'
import { emptyWizardValues } from '@/lib/campaigns/wizard'

export const metadata: Metadata = {
  title: 'New campaign',
  robots: { index: false, follow: false },
}

export default async function NewCampaignPage(props: PageProps<'/campaigns/new'>) {
  const { workspace } = await requireWorkspace()
  const { brands, products, balance } = await loadWizardData(workspace.id, workspace.plan)
  const search = await props.searchParams

  const defaultBrand = brands.find((brand) => brand.isDefault) ?? brands[0] ?? null
  // "Create campaign" from a product elsewhere can preselect it.
  const requested = typeof search.product === 'string' ? search.product : null
  const preselected =
    products.find((product) => product.id === requested) ??
    products.find((product) => product.brandId === defaultBrand?.id) ??
    null

  return (
    <PageBody>
      <PageHeader title="New campaign" description="Six quick steps. Only the product, goal, platforms and style are required." />
      <CampaignWizard
        brands={brands}
        products={products}
        initial={emptyWizardValues(preselected?.brandId ?? defaultBrand?.id ?? null, preselected?.id ?? null)}
        cost={creditCost('CAMPAIGN')}
        balance={balance}
      />
    </PageBody>
  )
}
