import type { ReactNode } from 'react'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getCreditSnapshot } from '@/lib/billing/credits'
import { AppShell } from '@/components/app/AppShell'

/**
 * Every signed-in route shares this layout, so the navigation and the
 * workspace it belongs to are resolved once per navigation rather than once
 * per page component.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, workspace, role } = await requireWorkspace()
  const credits = await getCreditSnapshot(workspace.id, workspace.plan)

  return (
    <AppShell
      user={{ id: user.id, email: user.email, name: user.name, plan: workspace.plan }}
      workspace={{ id: workspace.id, name: workspace.name, plan: workspace.plan, role }}
      credits={{
        balance: credits.balance,
        monthlyAllowance: credits.monthlyAllowance,
        periodEnd: credits.periodEnd.toISOString(),
      }}
    >
      {children}
    </AppShell>
  )
}
