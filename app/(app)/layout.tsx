import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/guards'
import { AppShell } from '@/components/AppShell'
import type { ConversationSummary } from '@/lib/types'

/**
 * Every signed-in route shares this layout, so the sidebar and its data are
 * fetched once per navigation rather than once per page component.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      model: true,
      pinned: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  const summaries: ConversationSummary[] = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    pinned: conversation.pinned,
    archivedAt: conversation.archivedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count.messages,
  }))

  return (
    <AppShell
      user={{ id: user.id, email: user.email, name: user.name, plan: user.plan }}
      conversations={summaries}
    >
      {children}
    </AppShell>
  )
}
