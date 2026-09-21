import { bookingStatusSchema } from '#shared/schemas/booking'
import { setOnlineBooking } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  await requireStaff(event, true)
  requireSameOrigin(event)
  const parsed = bookingStatusSchema.safeParse(await readLimitedJson(event, 1024))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Statusi i rezervimit nuk është i vlefshëm.' })
  if (parsed.data.enabled && !useRuntimeConfig(event).supabaseSecretKey) {
    throw createError({ statusCode: 503, statusMessage: 'Shtoni SUPABASE_SECRET_KEY në konfigurimin e serverit para aktivizimit të rezervimeve.' })
  }
  return setOnlineBooking(sessionClient(event), parsed.data.enabled, parsed.data.revision)
})
