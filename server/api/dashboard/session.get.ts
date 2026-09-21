export default defineEventHandler(async (event) => ({ staff: await requireStaff(event) }))
