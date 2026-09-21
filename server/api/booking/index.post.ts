import { guestBookingSchema } from '#shared/schemas/booking'
import { createGuestBooking } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  limitBookingRequest(event, 'booking')
  setHeader(event, 'Cache-Control', 'no-store')
  const parsed = guestBookingSchema.safeParse(await readLimitedJson(event, 8192))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Kontrolloni të dhënat e rezervimit.' })
  return { receipt: await createGuestBooking(createPrivilegedSupabaseClient(), parsed.data) }
})
