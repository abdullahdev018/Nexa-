'use client'

import { useCallback, useRef, useState } from 'react'
import type { Attachment } from '@/lib/ai/types'

interface SendOptions {
  conversationId: string | null
  message: string
  model: string
  attachments: Attachment[]
}

interface StreamHandlers {
  /** Fires once the server has resolved (or created) the thread. */
  onStart?: (info: { conversationId: string; title: string; isNewConversation: boolean }) => void
  onDelta?: (text: string) => void
  onDone?: (info: { conversationId: string }) => void
  onError?: (message: string) => void
}

/** Parses an SSE byte stream into `{event, data}` records. */
async function* parseSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        let event = 'message'
        const data: string[] = []
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trim())
        }
        if (data.length > 0) yield { event, data: data.join('\n') }

        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Owns one in-flight reply: the request, the abort handle, and the streaming
 * text. The component above decides what to do with each chunk.
 */
export function useChatStream() {
  const [streaming, setStreaming] = useState(false)
  const controller = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setStreaming(false)
  }, [])

  const send = useCallback(async (options: SendOptions, handlers: StreamHandlers) => {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          conversationId: options.conversationId,
          message: options.message,
          model: options.model,
          attachments: options.attachments,
        }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        handlers.onError?.(payload.error ?? `Request failed (${response.status}).`)
        return
      }

      for await (const frame of parseSSE(response.body)) {
        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(frame.data) as Record<string, unknown>
        } catch {
          continue
        }

        switch (frame.event) {
          case 'start':
            handlers.onStart?.({
              conversationId: String(payload.conversationId),
              title: String(payload.title ?? 'New chat'),
              isNewConversation: Boolean(payload.isNewConversation),
            })
            break
          case 'delta':
            handlers.onDelta?.(String(payload.text ?? ''))
            break
          case 'error':
            handlers.onError?.(String(payload.message ?? 'Something went wrong.'))
            break
          case 'done':
            handlers.onDone?.({ conversationId: String(payload.conversationId) })
            break
        }
      }
    } catch (error) {
      // An abort is the user pressing Stop — not a failure to report.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        handlers.onError?.('The connection was interrupted. Your message was saved.')
      }
    } finally {
      controller.current = null
      setStreaming(false)
    }
  }, [])

  return { send, stop, streaming }
}

/** Reads a File into the shape the chat API expects. */
export function readAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/')
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error(`Could not read ${file.name}`))
        return
      }
      resolve({
        name: file.name,
        kind: isImage ? 'image' : 'text',
        mediaType: file.type || 'text/plain',
        size: file.size,
        // Images keep only the base64 payload, not the `data:` URL prefix.
        data: isImage ? result.slice(result.indexOf(',') + 1) : result,
      })
    }

    if (isImage) reader.readAsDataURL(file)
    else reader.readAsText(file)
  })
}

/** Placeholder id for a message that exists only on the client so far. */
export function tempId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
