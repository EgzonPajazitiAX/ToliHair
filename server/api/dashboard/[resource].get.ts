import { managementResource } from '#shared/schemas/management'
import { loadManagement } from '../../repositories/management'

export default defineEventHandler(async (event) => {
  await requireStaff(event, true)
  if (!managementResource.safeParse(getRouterParam(event, 'resource')).success) throw createError({ statusCode: 404, statusMessage: 'Faqja nuk u gjet' })
  return loadManagement(sessionClient(event))
})
