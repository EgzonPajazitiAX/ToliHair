import type { H3Event } from 'h3'

// Bounded per-process guard for the initial single-node deployment. Supabase also
// enforces its Auth limits. Replace with shared storage before horizontal scaling.
const attempts = new Map<string, { count: number, until: number }>()
export function limitLogin(event: H3Event) {
  const now = Date.now()
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
  // Do not trust client-supplied forwarding headers.
  const ip = getRequestIP(event, { xForwardedFor: false }) || 'unknown'
  const entry = attempts.get(ip)
  if ((entry && entry.count >= 10) || (!entry && attempts.size >= 4096)) {
    setHeader(event, 'Retry-After', entry ? Math.ceil((entry.until - now) / 1000) : 60)
    throw createError({ statusCode: 429, statusMessage: 'Shumë tentativa për hyrje. Ju lutemi provoni përsëri më vonë.' })
  }
  attempts.set(ip, { count: (entry?.count || 0) + 1, until: entry?.until || now + 15 * 60 * 1000 })
}
