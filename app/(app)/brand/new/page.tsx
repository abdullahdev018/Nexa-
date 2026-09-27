import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getPlan, planAllows, planLimit } from '@/lib/billing/plans'
import { Alert } from '@/components/ui/Alert'
import { LinkButton } from '@/components/ui/Button'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { BrandForm } from '@/components/brand/BrandForm'

export const metadata: Metadata = {
  title: 'New brand',
  robots: { index: false, follow: false },
}

export default async function NewBrandPage() {
  const { workspace } = await requireWorkspace()
  const existing = await prisma.brand.count({ where: { workspaceId: workspace.id } })
  const limit = planLimit(workspace.plan, 'brands')

  return (
    <PageBody>
      <PageHeader
        title={existing === 0 ? 'Set up your brand' : 'New brand'}
        description="Only the name is required. The more you fill in, the more Nexa sounds like you."
      />

      {existing >= limit ? (
        <Alert>
          <p>
            The {getPlan(workspace.plan).name} plan includes {limit} brand
            {limit === 1 ? '' : 's'}, and this workspace has reached it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href="/brand" size="sm" variant="secondary">
              Back to Brand Kit
            </LinkButton>
            <LinkButton href="/billing#plans-heading" size="sm" variant="secondary">
              Compare plans
            </LinkButton>
          </div>
        </Alert>
      ) : (
        <BrandForm kitUnlocked={planAllows(workspace.plan, 'brandKit')} />
      )}
    </PageBody>
  )
}
