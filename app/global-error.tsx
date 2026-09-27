'use client' // Error boundaries must be Client Components

/**
 * The last line: the root layout itself failed. It renders its own document
 * without the app's stylesheet, so it is styled inline and kept deliberately
 * plain — it follows the OS colour scheme rather than the app theme.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          colorScheme: 'light dark',
          background: 'Canvas',
          color: 'CanvasText',
          padding: 20,
        }}
      >
        <title>Something went wrong · Nexa AI</title>
        <main role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Nexa could not load</h1>
          <p style={{ margin: 0, lineHeight: 1.5, opacity: 0.75 }}>
            Something went wrong on our side. Nothing you saved has been lost.
          </p>
          {error.digest && <p style={{ fontSize: 12, opacity: 0.55 }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 20, padding: '10px 18px', borderRadius: 8, border: 0, background: '#0b74e0', color: '#fff', fontSize: 15, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
