import { appointmentQuerySchema } from '#shared/schemas/appointments'
import { loadAppointments } from '../../repositories/appointments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const parsed = appointmentQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Filtrat e termineve nuk janë të vlefshëm.' })
  return loadAppointments(sessionClient(event), parsed.data)
})
