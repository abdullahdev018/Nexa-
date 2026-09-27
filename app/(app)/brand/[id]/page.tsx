import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { planAllows, planLimit } from '@/lib/billing/plans'
import { BRAND_SELECT, PRODUCT_SELECT, toBrandProfile } from '@/lib/brand/schema'
import { LinkButton } from '@/components/ui/Button'
import { PageBody, PageHeader } from '@/components/app/PageHeader'
import { BrandForm } from '@/components/brand/BrandForm'
import { ProductsPanel } from '@/components/brand/ProductsPanel'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Brand Kit',
  robots: { index: false, follow: false },
}

export default async function BrandDetailPage(props: PageProps<'/brand/[id]'>) {
  const { workspace } = await requireWorkspace()
  const { id } = await props.params

  const [row, brands, products] = await Promise.all([
    // Scoped by workspace as well as id: another tenant's brand is a 404.
    prisma.brand.findFirst({ where: { id, workspaceId: workspace.id }, select: BRAND_SELECT }),
    prisma.brand.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    prisma.product.findMany({
      where: { brandId: id, workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      select: PRODUCT_SELECT,
    }),
  ])
  if (!row) notFound()

  const brand = toBrandProfile(row)
  const canAddBrand = brands.length < planLimit(workspace.plan, 'brands')

  return (
    <PageBody>
      <PageHeader
        title="Brand Kit"
        description="The voice, colours and audience every generation writes in."
        actions={
          canAddBrand ? (
            <LinkButton href="/brand/new" variant="secondary" size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New brand
            </LinkButton>
          ) : null
        }
      />

      {brands.length > 1 && (
        <nav aria-label="Brands" className="-mt-2 mb-6 flex flex-wrap gap-1.5">
          {brands.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/brand/${candidate.id}`}
              aria-current={candidate.id === brand.id ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                candidate.id === brand.id
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
              )}
            >
              {candidate.name}
              {candidate.isDefault && <span className="ml-1.5 opacity-60">· default</span>}
            </Link>
          ))}
        </nav>
      )}

      {/* Keyed so switching brand remounts the form rather than carrying edits across. */}
      <BrandForm
        key={brand.id}
        brand={brand}
        kitUnlocked={planAllows(workspace.plan, 'brandKit')}
        brandCount={brands.length}
      />

      <ProductsPanel key={`products-${brand.id}`} brandId={brand.id} products={products} />
    </PageBody>
  )
}
