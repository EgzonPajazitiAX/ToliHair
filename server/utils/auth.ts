import { createServerClient } from '@supabase/ssr'
import type { H3Event } from 'h3'
import type { Database } from '../types/database.types'
import type { StaffIdentity } from '../../shared/types/auth'

export function sessionClient(event: H3Event) {
  if (event.context.sessionClient) return event.context.sessionClient
  const config = useRuntimeConfig(event)
  if (!config.public.supabaseUrl || !config.public.supabasePublishableKey) {
    throw createError({ statusCode: 503, statusMessage: 'Hyrja e stafit nuk është konfiguruar' })
  }
  const jar = new Map(Object.entries(parseCookies(event)))
  const client = createServerClient<Database>(config.public.supabaseUrl, config.public.supabasePublishableKey, {
    cookieOptions: { name: 'toli-staff', httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll(cookies, headers) {
        for (const { name, value, options } of cookies) {
          jar.set(name, value)
          setCookie(event, name, value, { ...options, httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/' })
        }
        for (const [name, value] of Object.entries(headers)) setHeader(event, name, value)
        setHeader(event, 'Cache-Control', 'private, no-store')
      },
    },
  })
  event.context.sessionClient = client
  return client
}

export function clearStaffCookies(event: H3Event) {
  for (const name of Object.keys(parseCookies(event))) {
    if (name === 'toli-staff' || name.startsWith('toli-staff.')) {
      deleteCookie(event, name, { path: '/', httpOnly: true, secure: !import.meta.dev, sameSite: 'lax' })
    }
  }
}

export async function readStaff(event: H3Event): Promise<StaffIdentity | null> {
  if (event.context.staff !== undefined) return event.context.staff
  const client = sessionClient(event)
  // Verify with Supabase Auth; never authorize from a decoded cookie/session object.
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) {
    if (error && error.status && error.status >= 500) {
      throw createError({ statusCode: 503, statusMessage: 'Shërbimi i hyrjes nuk është përkohësisht i disponueshëm' })
    }
    event.context.staff = null
    return null
  }
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('id, full_name, role, is_active').eq('id', data.user.id).maybeSingle()
  if (profileError) throw createError({ statusCode: 503, statusMessage: 'Qasja e stafit nuk mund të verifikohej' })
  event.context.staff = profile?.is_active
    ? { id: profile.id, fullName: profile.full_name, role: profile.role }
    : null
  return event.context.staff
}

export async function requireStaff(event: H3Event, adminOnly = false) {
  const staff = await readStaff(event)
  if (!staff) throw createError({ statusCode: 401, statusMessage: 'Kërkohet hyrja e stafit' })
  if (adminOnly && staff.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Kërkohet qasja e administratorit' })
  return staff
}
