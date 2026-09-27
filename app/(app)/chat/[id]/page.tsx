import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { getModel } from '@/lib/ai/models'
import { ChatView } from '@/components/chat/ChatView'
import type { AttachmentMeta, UiMessage } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
}

export default async function ConversationPage(props: PageProps<'/chat/[id]'>) {
  const { user, workspace } = await requireWorkspace()
  const { id } = await props.params

  const [conversation, preferences] = await Promise.all([
    prisma.conversation.findFirst({
      // Scoped by workspace and user as well as id: an id belonging to anyone
      // else is a 404, not a permission error, so nothing is revealed by
      // guessing one.
      where: { id, userId: user.id, workspaceId: workspace.id },
      select: {
        id: true,
        model: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            model: true,
            error: true,
            createdAt: true,
            attachments: true,
          },
        },
      },
    }),
    prisma.preferences.findUnique({
      where: { userId: user.id },
      select: { enterToSend: true },
    }),
  ])

  if (!conversation) notFound()

  const messages: UiMessage[] = conversation.messages
    // SYSTEM rows are not conversational turns and are never displayed.
    .filter((message) => message.role !== 'SYSTEM')
    .map((message) => ({
      id: message.id,
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      model: message.model,
      error: message.error,
      attachments: (message.attachments as AttachmentMeta[] | null) ?? undefined,
    }))

  return (
    <ChatView
      key={conversation.id}
      conversationId={conversation.id}
      initialMessages={messages}
      initialModel={getModel(conversation.model).id}
      user={{ id: user.id, email: user.email, name: user.name, plan: workspace.plan }}
      enterToSend={preferences?.enterToSend ?? true}
    />
  )
}
