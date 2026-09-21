import { staffAvailabilityQuerySchema } from '#shared/schemas/appointments'
import { loadStaffAvailability } from '../../repositories/appointments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const parsed = staffAvailabilityQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Kërkesa për oraret nuk është e vlefshme.' })
  return loadStaffAvailability(sessionClient(event), parsed.data)
})
