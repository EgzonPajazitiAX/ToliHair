export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { error } = await sessionClient(event).auth.signOut({ scope: 'local' })
  clearStaffCookies(event)
  if (error && error.status && error.status >= 500) {
    throw createError({ statusCode: 503, statusMessage: 'Dalja lokale përfundoi, por mbyllja e sesionit nuk mund të konfirmohej' })
  }
  return { success: true }
})
