import { loadBookingCatalog } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  limitBookingRequest(event, 'catalog')
  setHeader(event, 'Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=30')
  return loadBookingCatalog(createPublicSupabaseClient())
})
