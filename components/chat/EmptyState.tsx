'use client'

import { Code2, FileText, Lightbulb, PenLine, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

interface Suggestion {
  icon: LucideIcon
  label: string
  prompt: string
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: PenLine,
    label: 'Draft something',
    prompt: 'Draft a short, friendly email following up on a proposal I sent last week.',
  },
  {
    icon: Code2,
    label: 'Explain code',
    prompt: 'Explain what this function does and suggest one improvement:\n\n',
  },
  {
    icon: FileText,
    label: 'Summarise a document',
    prompt: 'Summarise the key points of the attached document and list any open questions.',
  },
  {
    icon: Lightbulb,
    label: 'Think it through',
    prompt: 'Help me think through a decision. Ask me the questions you need answered first.',
  },
]

export function EmptyState({
  name,
  onPick,
}: {
  name: string | null
  onPick: (prompt: string) => void
}) {
  const firstName = name?.split(' ')[0]

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-5 py-12 text-center">
      <Logo size={44} href={null} />

      <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-ink-900">
        {firstName ? `What can I help with, ${firstName}?` : 'What can I help with?'}
      </h1>
      <p className="mt-2 text-[15px] text-ink-600">
        Ask a question, paste something in, or attach a file to work from.
      </p>

      <div className="mt-9 grid w-full gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onPick(suggestion.prompt)}
            className="flex items-center gap-3 rounded-xl border border-ink-200 bg-raised px-4 py-3.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <suggestion.icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <span className="text-[14.5px] font-medium text-ink-800">{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
