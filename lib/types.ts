/** Shapes shared between the server components and the chat client. */
import type { PlanId } from '@/lib/billing/plans'


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
  /** The ACTIVE WORKSPACE's plan — billing is per workspace, not per person. */
  plan: PlanId
}

export interface UserPreferences {
  defaultModel: string
  customInstructions: string | null
  theme: 'LIGHT' | 'DARK' | 'SYSTEM'
  enterToSend: boolean
}

/** The workspace the person is currently acting in. */
export interface WorkspaceSummary {
  id: string
  name: string
  plan: PlanId
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

/** Credit standing, shaped for the client. */
export interface CreditSummary {
  balance: number
  monthlyAllowance: number
  /** ISO — when the balance next resets. */
  periodEnd: string
}
