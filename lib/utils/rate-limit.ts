import 'server-only'

/**
 * Fixed-window, in-memory rate limiting.
 *
 * This is the right size for a single Node instance: no store to run, no
 * network hop on the hot path. It does not coordinate across instances, so on
 * a multi-instance deployment each one limits independently — set the limits
 * per instance, or move this behind Redis if that stops being good enough.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

/** Drops expired buckets so the map cannot grow one entry per IP forever. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  bucket.count += 1
  const remaining = Math.max(0, limit - bucket.count)
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, remaining, retryAfter: 0 }
}

/**
 * Best-effort client address, for rate limiting only.
 *
 * Headers the hosting platform sets itself come first: a client can write any
 * `X-Forwarded-For` it likes, and if the first entry were trusted it could
 * rotate it for a fresh bucket on every request. `x-vercel-forwarded-for` and
 * `x-real-ip` are overwritten by Vercel's edge. Only without them is the
 * right-most `X-Forwarded-For` hop used — the one the nearest proxy appended.
 * With none at all, every caller shares one bucket: it fails closed.
 */
export function clientIp(request: Request): string {
  const platform = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-real-ip')
  if (platform) return platform.split(',')[0].trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',').at(-1)!.trim()
  return 'unknown'
}
