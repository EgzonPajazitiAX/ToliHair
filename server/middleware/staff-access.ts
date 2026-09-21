import { decodedAuthPath, isDashboardPath, requiresAdmin } from '#shared/utils/auth-policy'

export default defineEventHandler(async (event) => {
  const path = decodedAuthPath(getRequestURL(event).pathname)
  if (/^\/api\/auth(?:\/|$)/.test(path) || isDashboardPath(path)) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'Vary', 'Cookie')
  }
  if (!isDashboardPath(path)) return
  if (!['GET', 'HEAD'].includes(event.method)) requireSameOrigin(event)
  const staff = await readStaff(event)
  if (!staff) {
    if (path.startsWith('/api/')) throw createError({ statusCode: 401, statusMessage: 'Kërkohet hyrja e stafit' })
    return sendRedirect(event, `/login?redirect=${encodeURIComponent(path)}`, 302)
  }
  if (requiresAdmin(path) && staff.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Kërkohet qasja e administratorit' })
  }
})
