import { PageBody, PageHeader } from './PageHeader'
import { navItem } from '@/lib/content/navigation'

/**
 * A section that is not built yet.
 *
 * It says so plainly rather than showing a mock dashboard. Nothing here
 * pretends to hold data, and there is no button that looks like it works and
 * does not — an unbuilt section that looks finished is the exact failure this
 * product is meant to avoid. No plan is named until the section launches.
 */
export function SectionPlaceholder({
  href,
  detail,
}: {
  href: string
  /** What the section will do, in the user's terms. */
  detail: string[]
}) {
  const item = navItem(href)
  if (!item) return null

  const Icon = item.icon

  return (
    <PageBody>
      <PageHeader title={item.label} description={item.description} />

      <div className="animate-rise overflow-hidden rounded-3xl border border-ink-200 bg-raised shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-100 via-pink-100 to-violet-200 px-6 py-10 text-center dark:from-amber-400/15 dark:via-pink-400/10 dark:to-violet-500/20 sm:py-12">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="animate-float absolute left-[12%] top-[20%] text-lg">✨</span>
            <span className="animate-float absolute right-[14%] top-[26%] text-xl [animation-delay:0.7s]">⭐</span>
            <span className="animate-float absolute bottom-[14%] left-[9%] text-base [animation-delay:1.2s]">✨</span>
            <span className="animate-float absolute bottom-[14%] right-[10%] text-base [animation-delay:0.4s]">💫</span>
          </div>

          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="animate-glow absolute inset-0 rounded-full bg-white/70 blur-md dark:bg-white/10" aria-hidden="true" />
            <span className="animate-float relative text-[52px] leading-none [animation-duration:2.6s]" aria-hidden="true">
              🚀
            </span>
          </div>

          <p className="relative mt-4 text-[30px] font-extrabold uppercase tracking-tight text-ink-900 sm:text-[36px]">
            Coming soon!
          </p>
          <p className="relative mx-auto mt-2 inline-flex max-w-md items-center gap-2 text-[14.5px] text-ink-700">
            <Icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
            {item.label} is on its way. Nothing here is live yet.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">
              What it will do
            </p>
            <ul className="mt-3 space-y-2">
              {detail.map((line) => (
                <li key={line} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-700">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PageBody>
  )
}
