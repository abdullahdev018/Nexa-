/** Shapes shared between the server components and the chat client. */

export interface AttachmentMeta {
  name: string
  kind: 'image' | 'text'
  mediaType: string
  size: number
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  model?: string | null
  error?: string | null
  attachments?: AttachmentMeta[]
  /** True while this message is still being streamed. */
  streaming?: boolean
}

export interface ConversationSummary {
  id: string
  title: string
  model: string
  pinned: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  plan: 'FREE' | 'PRO' | 'TEAM'
}

export interface UserPreferences {
  defaultModel: string
  customInstructions: string | null
  theme: 'LIGHT' | 'DARK' | 'SYSTEM'
  enterToSend: boolean
}
