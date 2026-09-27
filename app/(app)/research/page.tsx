import type { Metadata } from 'next'
import { requireWorkspace } from '@/lib/auth/workspace'
import { SectionPlaceholder } from '@/components/app/SectionPlaceholder'

export const metadata: Metadata = {
  title: 'Competitor Research',
  robots: { index: false, follow: false },
}

export default async function ResearchPage() {
  // Signed-in only, like every other section.
  await requireWorkspace()

  return (
    <SectionPlaceholder
      href='/research'
      detail={[
        'Give Nexa a competitor website and it summarises their positioning, messaging, offering, content themes and CTA patterns.',
        'It looks for the gaps, and suggests ideas drawn from the category rather than copied from them.',
        'This needs a web or search provider. None is connected, so research cannot run yet.',
      ]}
    />
  )
}
