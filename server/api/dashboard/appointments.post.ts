import { appointmentMutationSchema } from '#shared/schemas/appointments'
import { saveAppointment } from '../../repositories/appointments'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  requireSameOrigin(event)
  const parsed = appointmentMutationSchema.safeParse(await readLimitedJson(event, 8192))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Kontrolloni të dhënat e terminit.', data: { issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) } })
  return saveAppointment(sessionClient(event), parsed.data)
})
