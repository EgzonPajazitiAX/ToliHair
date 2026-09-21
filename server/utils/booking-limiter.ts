import type { H3Event } from 'h3'

type Action = 'catalog' | 'availability' | 'booking' | 'receipt'
const rules: Record<Action, { limit: number, window: number }> = {
  catalog: { limit: 120, window: 60_000 },
  availability: { limit: 120, window: 60_000 },
  booking: { limit: 10, window: 15 * 60_000 },
  receipt: { limit: 60, window: 60_000 },
}
const entries = new Map<string, { count: number, reset: number }>()

export function limitBookingRequest(event: H3Event, action: Action) {
  const now = Date.now()
  for (const [key, entry] of entries) if (entry.reset <= now) entries.delete(key)
  const rule = rules[action]
  const ip = getRequestIP(event, { xForwardedFor: false }) || 'unknown'
  const key = `${action}:${ip}`
  const current = entries.get(key)
  const entry = current && current.reset > now ? current : { count: 0, reset: now + rule.window }
  if (entry.count >= rule.limit || (!current && entries.size >= 4096)) {
    const retry = Math.max(1, Math.ceil((entry.reset - now) / 1000))
    setHeader(event, 'Retry-After', retry)
    throw createError({ statusCode: 429, statusMessage: 'Shumë kërkesa. Ju lutemi provoni përsëri më vonë.' })
  }
  entry.count++
  entries.set(key, entry)
  setHeader(event, 'X-RateLimit-Limit', rule.limit)
  setHeader(event, 'X-RateLimit-Remaining', rule.limit - entry.count)
}
