import { decodedAuthPath, isDashboardPath, requiresAdmin, safeDashboardRedirect } from '#shared/utils/auth-policy'

export default defineEventHandler(async (event) => {
  const path = decodedAuthPath(getRequestURL(event).pathname)
  const isLogin = /^\/login\/?$/.test(path)
  if (isLogin || /^\/api\/auth(?:\/|$)/.test(path) || isDashboardPath(path)) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    setHeader(event, 'Vary', 'Cookie')
  }
  if (isLogin && ['GET', 'HEAD'].includes(event.method)) {
    // Validate on the original request so renewed cookies reach the browser.
    const staff = await readStaff(event)
    if (staff) {
      const target = safeDashboardRedirect(getQuery(event).redirect)
      return sendRedirect(event, requiresAdmin(target) && staff.role !== 'admin' ? '/dashboard' : target, 302)
    }
    return
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
