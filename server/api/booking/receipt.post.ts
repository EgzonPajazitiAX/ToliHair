import { receiptSchema } from '#shared/schemas/booking'
import { loadBookingReceipt } from '../../repositories/booking'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  limitBookingRequest(event, 'receipt')
  setHeader(event, 'Cache-Control', 'no-store')
  const parsed = receiptSchema.safeParse(await readLimitedJson(event, 1024))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Tokeni i konfirmimit nuk është i vlefshëm.' })
  return { receipt: await loadBookingReceipt(createPrivilegedSupabaseClient(), parsed.data.token) }
})
