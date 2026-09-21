import { isDashboardPath, requiresAdmin } from '#shared/utils/auth-policy'

export default defineNuxtRouteMiddleware(async (to) => {
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
