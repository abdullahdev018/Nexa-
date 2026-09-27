'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExternalLink, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useApiForm } from '@/lib/hooks/useApiForm'
import { MAX_PRODUCTS_PER_BRAND, type BrandProduct } from '@/lib/brand/schema'

type Draft = Record<'name' | 'description' | 'url' | 'imageUrl' | 'category' | 'price', string>

const EMPTY: Draft = { name: '', description: '', url: '', imageUrl: '', category: '', price: '' }

function toDraft(product: BrandProduct): Draft {
  return {
    name: product.name,
    description: product.description ?? '',
    url: product.url ?? '',
    imageUrl: product.imageUrl ?? '',
    category: product.category ?? '',
    price: product.price ?? '',
  }
}

/** The products a brand sells — what campaigns are built around. */
export function ProductsPanel({ brandId, products }: { brandId: string; products: BrandProduct[] }) {
  const router = useRouter()
  const remover = useApiForm()
  /** 'new', a product id, or null when nothing is open. */
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BrandProduct | null>(null)

  async function confirmDelete() {
    if (!deleting) return
    const result = await remover.submit(`/api/products/${deleting.id}`, {}, 'DELETE')
    remover.stop()
    setDeleting(null)
    if (result) router.refresh()
  }

  const full = products.length >= MAX_PRODUCTS_PER_BRAND

  return (
    <section className="border-t border-ink-200 py-8" aria-labelledby="products-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="products-heading" className="text-[16px] font-semibold text-ink-900">
            Products
          </h2>
          <p className="mt-1 text-[14px] text-ink-600">
            What you sell. A campaign starts from one of these.
          </p>
        </div>
        {editing !== 'new' && !full && (
          <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add product
          </Button>
        )}
      </div>

      {remover.error && <Alert className="mt-5">{remover.error}</Alert>}

      <div className="mt-5 space-y-3">
        {editing === 'new' && (
          <ProductEditor
            url={`/api/brands/${brandId}/products`}
            method="POST"
            initial={EMPTY}
            onDone={() => setEditing(null)}
          />
        )}

        {products.length === 0 && editing !== 'new' && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-300 bg-ink-50/60 px-6 py-10 text-center">
            <Package className="h-5 w-5 text-ink-400" aria-hidden="true" />
            <p className="mt-3 text-[14px] text-ink-600">No products yet.</p>
          </div>
        )}

        {products.map((product) =>
          editing === product.id ? (
            <ProductEditor
              key={product.id}
              url={`/api/products/${product.id}`}
              method="PATCH"
              initial={toDraft(product)}
              onDone={() => setEditing(null)}
            />
          ) : (
            <article
              key={product.id}
              className="flex items-start gap-4 rounded-xl border border-ink-200 bg-raised p-4 shadow-xs"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-[14.5px] font-semibold text-ink-900">{product.name}</h3>
                {(product.category || product.price) && (
                  <p className="mt-0.5 text-[12.5px] text-ink-500">
                    {[product.category, product.price].filter(Boolean).join(' · ')}
                  </p>
                )}
                {product.description && (
                  <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-700">
                    {product.description}
                  </p>
                )}
                {product.url && (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline"
                  >
                    Product page
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${product.name}`}
                  onClick={() => setEditing(product.id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${product.name}`}
                  onClick={() => setDeleting(product)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </article>
          ),
        )}
      </div>

      {full && (
        <p className="mt-3 text-[13px] text-ink-500">
          A brand can hold up to {MAX_PRODUCTS_PER_BRAND} products.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? 'this product'}?`}
        body="Campaigns and videos already made for it are kept."
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        busy={remover.submitting}
      />
    </section>
  )
}

function ProductEditor({
  url,
  method,
  initial,
  onDone,
}: {
  url: string
  method: 'POST' | 'PATCH'
  initial: Draft
  onDone: () => void
}) {
  const router = useRouter()
  const form = useApiForm()
  const [draft, setDraft] = useState(initial)

  function set(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    form.clearField(key)
  }

  async function save() {
    const result = await form.submit(url, draft, method)
    if (!result) return
    form.stop()
    onDone()
    router.refresh()
  }

  const text = (key: keyof Draft, label: string, placeholder: string, max: number) => (
    <Field label={label} error={form.fields[key]}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          value={draft[key]}
          maxLength={max}
          onChange={(event) => set(key, event.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          invalid={invalid}
        />
      )}
    </Field>
  )

  return (
    <form
      className="rounded-xl border border-brand-200 bg-raised p-4 shadow-xs sm:p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {form.error && <Alert className="mb-4">{form.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Product name', 'Fig & Cedar Candle', 120)}
        {text('category', 'Category', 'Home fragrance', 80)}
        {text('price', 'Price', '$28', 40)}
        {text('url', 'Product page', 'lumencandles.com/fig-cedar', 2048)}
      </div>
      <div className="mt-4">
        <Field
          label="Description"
          hint="What it is, who it is for, and why someone would pick it."
          error={form.fields.description}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              rows={3}
              maxLength={2000}
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>
      <div className="mt-4">{text('imageUrl', 'Image URL', 'https://…/fig-cedar.jpg', 2048)}</div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={form.submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.submitting || !draft.name.trim()}>
          {form.submitting ? <Spinner label="Saving" /> : method === 'POST' ? 'Add product' : 'Save product'}
        </Button>
      </div>
    </form>
  )
}
