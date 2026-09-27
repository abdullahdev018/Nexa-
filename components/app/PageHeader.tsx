import type { ReactNode } from 'react'

/** The standard heading for a workspace section. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-600">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** The scroll container every section page sits in. */
export function PageBody({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="scroll-subtle h-full overflow-y-auto">
      <div className={`mx-auto px-5 py-8 sm:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {children}
      </div>
    </div>
  )
}
