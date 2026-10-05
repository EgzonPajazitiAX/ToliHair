import { startTimesQuerySchema } from '#shared/schemas/booking'
import { loadStartTimes } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  limitBookingRequest(event, 'availability')
  setHeader(event, 'Cache-Control', 'no-store')
  const parsed = startTimesQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Zgjidhni një datë dhe berber të vlefshëm.' })
  return { slots: await loadStartTimes(createPublicSupabaseClient(), parsed.data) }
})
