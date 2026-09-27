import type { ReactNode } from 'react'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { AssistantPanel } from '@/components/app/AssistantPanel'
import type { ConversationSummary } from '@/lib/types'

/**
 * Wraps the AI Assistant with its conversation list. Fetched once here rather
 * than in each chat page, so switching threads does not re-query the list.
 */
export default async function AssistantLayout({ children }: { children: ReactNode }) {
  const { user, workspace } = await requireWorkspace()

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id, workspaceId: workspace.id, archivedAt: null },
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

  return <AssistantPanel conversations={summaries}>{children}</AssistantPanel>
}
