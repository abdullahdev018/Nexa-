import type { Metadata } from 'next'
import { prisma } from '@/lib/db/prisma'
import { requireWorkspace } from '@/lib/auth/workspace'
import { DEFAULT_MODEL_ID, getModel } from '@/lib/ai/models'
import { ChatView } from '@/components/chat/ChatView'

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
}

/** A new, unsaved conversation. The thread is created on the first message. */
export default async function NewChatPage() {
  const { user, workspace } = await requireWorkspace()

  const preferences = await prisma.preferences.findUnique({
    where: { userId: user.id },
    select: { defaultModel: true, enterToSend: true },
  })

  return (
    <ChatView
      key="new-chat"
      conversationId={null}
      initialMessages={[]}
      initialModel={getModel(preferences?.defaultModel ?? DEFAULT_MODEL_ID).id}
      user={{ id: user.id, email: user.email, name: user.name, plan: workspace.plan }}
      enterToSend={preferences?.enterToSend ?? true}
    />
  )
}
