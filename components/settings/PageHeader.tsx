import type { ReactNode } from 'react'

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="border-b border-ink-200 pb-6">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink-900">{title}</h1>
      {description ? (
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-600">{description}</p>
      ) : null}
    </header>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-ink-200 py-8 last:border-0">
      <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
      {description ? <p className="mt-1 text-[14px] text-ink-600">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}
