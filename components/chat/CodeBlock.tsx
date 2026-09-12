'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlight, resolveLanguage, TOKEN_CLASS } from '@/lib/utils/highlight'
import { cn } from '@/lib/utils/cn'

export function CodeBlock({ code, language }: { code: string; language: string | null }) {
  const [copied, setCopied] = useState(false)
  const tokens = useMemo(() => highlight(code, language), [code, language])
  const label = resolveLanguage(language) ?? language ?? 'text'

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can be denied (insecure context, permissions). The
      // code is selectable, so there is nothing useful to say.
    }
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-night-800 bg-night-950">
      <div className="flex items-center justify-between border-b border-night-800 px-3.5 py-2">
        <span className="font-mono text-[11.5px] uppercase tracking-wide text-night-400">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
            copied ? 'text-brand-300' : 'text-night-400 hover:bg-night-800 hover:text-night-100',
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>

      <pre className="scroll-subtle overflow-x-auto px-4 py-3.5 text-[13px] leading-[1.65]">
        <code className="font-mono text-night-100">
          {tokens.map((token, index) =>
            token.type === 'plain' ? (
              token.value
            ) : (
              <span key={index} className={TOKEN_CLASS[token.type]}>
                {token.value}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  )
}
