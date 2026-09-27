import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Palette, Plus } from 'lucide-react'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getDefaultBrand } from '@/lib/brand/queries'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { navItem } from '@/lib/content/navigation'

export const metadata: Metadata = {
  title: 'Brand Kit',
  robots: { index: false, follow: false },
}

/** Opens the default brand, or explains what a brand is when there is none. */
export default async function BrandPage() {
  const { workspace } = await requireWorkspace()
  const brand = await getDefaultBrand(workspace.id)
  if (brand) redirect(`/brand/${brand.id}`)

  const item = navItem('/brand')

  return (
    <PageBody>
      <PageHeader title="Brand Kit" description={item?.description} />
      <EmptyState
        icon={Palette}
        title="No brand yet"
        description="Tell Nexa who you are, who you sell to and how you sound. Every campaign, post and ad is written from this."
        action={
          <LinkButton href="/brand/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Set up your brand
          </LinkButton>
        }
      />
    </PageBody>
  )
}
