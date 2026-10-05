import { isDashboardPath, requiresAdmin, safeDashboardRedirect } from '#shared/utils/auth-policy'

export default defineNuxtRouteMiddleware(async (to) => {
  if (/^\/login\/?$/.test(to.path) && !useError().value) {
    // Direct requests are handled by server middleware; check client navigation too.
    if (import.meta.server) return
    const { refresh } = useAuth()
    try {
      const staff = await refresh()
      if (staff) {
        const target = safeDashboardRedirect(to.query.redirect)
        return navigateTo(requiresAdmin(target) && staff.role !== 'admin' ? '/dashboard' : target, { replace: true })
      }
    }
    catch {
      throw createError({ statusCode: 503, statusMessage: 'Sesioni nuk mund të verifikohej. Provoni përsëri pas pak.' })
    }
    return
  }
  if (!isDashboardPath(to.path) || useError().value) return
  const { staff, refresh } = useAuth()
  if (import.meta.server) {
    // The server middleware verified this request and refreshed response cookies.
    staff.value = useRequestEvent()?.context.staff ?? null
  }
  else {
    try { await refresh() }
    catch { staff.value = null }
  }
  if (!staff.value) return navigateTo({ path: '/login', query: { redirect: to.path } }, { replace: true })
  if (requiresAdmin(to.path) && staff.value.role !== 'admin') return abortNavigation(createError({ statusCode: 403, statusMessage: 'Kërkohet qasja e administratorit' }))
})
