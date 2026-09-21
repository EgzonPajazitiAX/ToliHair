import { availabilityQuerySchema } from '#shared/schemas/booking'
import { loadAvailability } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  limitBookingRequest(event, 'availability')
  setHeader(event, 'Cache-Control', 'no-store')
  const parsed = availabilityQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Zgjidhni shërbimet, datën dhe berberin e vlefshëm.' })
  return { slots: await loadAvailability(createPublicSupabaseClient(), parsed.data) }
})
