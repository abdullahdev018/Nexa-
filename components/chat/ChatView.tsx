'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import type { Attachment } from '@/lib/ai/types'
import { tempId, useChatStream } from '@/lib/hooks/useChatStream'
import type { CurrentUser, UiMessage } from '@/lib/types'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'
import { Message } from './Message'

interface ChatViewProps {
  conversationId: string | null
  initialMessages: UiMessage[]
  initialModel: string
  user: CurrentUser
  enterToSend: boolean
}

export function ChatView({
  conversationId,
  initialMessages,
  initialModel,
  user,
  enterToSend,
}: ChatViewProps) {
  const router = useRouter()
  const { send, stop, streaming } = useChatStream()

  const [messages, setMessages] = useState<UiMessage[]>(initialMessages)
  const [model, setModel] = useState(initialModel)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)

  const scroller = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)
  // The id of the thread this view is writing to; set as soon as the server
  // reports it, so the second message in a brand-new chat lands in the same
  // conversation rather than creating another.
  //
  // No effect keeps this in sync with the prop: every caller passes a `key`
  // tied to the conversation, so switching threads remounts this component
  // and all of its state starts correct.
  const activeId = useRef(conversationId)

  // Follow the reply as it streams, but stop following the moment the user
  // scrolls up to read something earlier.
  useEffect(() => {
    if (!pinnedToBottom.current) return
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const onScroll = useCallback(() => {
    const node = scroller.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    pinnedToBottom.current = distance < 80
  }, [])

  const onSend = useCallback(
    (text: string, attachments: Attachment[]) => {
      setError(null)
      pinnedToBottom.current = true

      const userMessage: UiMessage = {
        id: tempId('user'),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        attachments: attachments.map(({ name, kind, mediaType, size }) => ({
          name,
          kind,
          mediaType,
          size,
        })),
      }

      const replyId = tempId('assistant')
      const placeholder: UiMessage = {
        id: replyId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        model,
        streaming: true,
      }

      setMessages((current) => [...current, userMessage, placeholder])

      let createdNewThread = false

      void send(
        { conversationId: activeId.current, message: text, model, attachments },
        {
          onStart: ({ conversationId: id, isNewConversation }) => {
            activeId.current = id
            createdNewThread = isNewConversation
          },
          onDelta: (chunk) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === replyId
                  ? { ...message, content: message.content + chunk }
                  : message,
              ),
            )
          },
          onError: (message) => {
            setMessages((current) =>
              current.map((item) =>
                item.id === replyId ? { ...item, streaming: false, error: message } : item,
              ),
            )
            setError(message)
          },
          onDone: ({ conversationId: id }) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === replyId ? { ...message, streaming: false } : message,
              ),
            )

            if (createdNewThread) {
              // Move to the thread's own URL so a reload, a bookmark or the
              // back button all land on this conversation.
              router.replace(`/chat/${id}`)
            }
            // Refresh either way: the sidebar's ordering and titles live in a
            // server component.
            router.refresh()
          },
        },
      )
    },
    [model, router, send],
  )

  const showEmpty = messages.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="scroll-subtle min-h-0 flex-1 overflow-y-auto"
      >
        {showEmpty ? (
          <EmptyState name={user.name} onPick={setDraft} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <Alert className="mb-2">{error}</Alert>
        </div>
      )}

      <Composer
        key={draft ?? 'composer'}
        onSend={onSend}
        onStop={stop}
        streaming={streaming}
        model={model}
        onModelChange={setModel}
        plan={user.plan}
        enterToSend={enterToSend}
        initialValue={draft ?? ''}
        autoFocus={Boolean(draft) || showEmpty}
      />
    </div>
  )
}
