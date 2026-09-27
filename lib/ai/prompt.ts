import type { ChatMessage } from './types'

const BASE = `You are Nexa, an AI assistant made by Nexa AI.

Formatting: reply in Markdown. Use headings, bullet and numbered lists, tables
and fenced code blocks (always tagged with the language) where they genuinely
help. Never wrap an entire reply in a code fence. Keep prose tight — no filler
preamble and no restating the question back.

Be direct and useful. If a request is ambiguous in a way that changes the
answer, ask one clarifying question instead of guessing at length.`

export interface PromptContext {
  name?: string | null
  /** What the user said they do, captured during onboarding. */
  role?: string | null
  useCases?: string[]
  /** Standing preferences from Settings. */
  customInstructions?: string | null
  /** The workspace's brand, already rendered by `brandContextBlock`. */
  brand?: string | null
}

/**
 * Assembles the system prompt. The user's own instructions are appended rather
 * than substituted, so nothing a user types can replace Nexa's operating
 * instructions wholesale.
 */
export function buildSystemPrompt(context: PromptContext): string {
  const parts = [BASE]

  const about: string[] = []
  if (context.name) about.push(`Their name is ${context.name}.`)
  if (context.role) about.push(`They describe their work as: ${context.role}.`)
  if (context.useCases?.length) {
    about.push(`They mainly use Nexa for: ${context.useCases.join(', ')}.`)
  }
  if (about.length > 0) {
    parts.push(`About the person you are talking to:\n${about.join('\n')}`)
  }

  if (context.brand) parts.push(context.brand)

  const custom = context.customInstructions?.trim()
  if (custom) {
    parts.push(
      'The user has set standing preferences. Follow them unless they conflict ' +
        `with the instructions above:\n${custom.slice(0, 4000)}`,
    )
  }

  return parts.join('\n\n')
}

/** Titles a thread from its first user message; the model is not asked. */
export function deriveTitle(firstMessage: string): string {
  const cleaned = firstMessage
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'New chat'
  if (cleaned.length <= 48) return cleaned
  // Prefer a word boundary so titles do not end mid-word.
  const cut = cleaned.slice(0, 48)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

/** Caps how much history is replayed so a long thread cannot blow the budget. */
export function trimHistory(messages: ChatMessage[], max = 40): ChatMessage[] {
  const recent = messages.slice(-max)
  // The API requires the conversation to open with a user turn.
  while (recent.length > 0 && recent[0].role !== 'user') recent.shift()
  return recent
}
