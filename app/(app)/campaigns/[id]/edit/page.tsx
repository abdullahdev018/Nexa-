import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { creditCost } from '@/lib/billing/plans'
import { loadWizardData } from '@/lib/campaigns/queries'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'
import { emptyWizardValues } from '@/lib/campaigns/wizard'

export const metadata: Metadata = {
  title: 'Edit brief',
  robots: { index: false, follow: false },
}

export default async function EditCampaignPage(props: PageProps<'/campaigns/[id]/edit'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params

  const [campaign, data] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
      select: {
        id: true,
        name: true,
        brandId: true,
        productId: true,
        goal: true,
        style: true,
        platforms: true,
        audienceAgeRange: true,
        audienceLocation: true,
        audienceInterests: true,
        audienceCustomerType: true,
        audiencePainPoints: true,
      },
    }),
    loadWizardData(workspace.id, workspace.plan),
  ])
  if (!campaign) notFound()

  const initial = {
    ...emptyWizardValues(campaign.brandId, campaign.productId),
    name: campaign.name,
    goal: campaign.goal,
    style: campaign.style,
    platforms: campaign.platforms,
    audienceAgeRange: campaign.audienceAgeRange ?? '',
    audienceLocation: campaign.audienceLocation ?? '',
    audienceInterests: campaign.audienceInterests,
    audienceCustomerType: campaign.audienceCustomerType ?? '',
    audiencePainPoints: campaign.audiencePainPoints ?? '',
  }

  return (
    <PageBody>
      <PageHeader title="Edit brief" description={campaign.name} />
      <CampaignWizard
        brands={data.brands}
        products={data.products}
        initial={initial}
        campaignId={campaign.id}
        cost={creditCost('CAMPAIGN')}
        balance={data.balance}
      />
    </PageBody>
  )
}
