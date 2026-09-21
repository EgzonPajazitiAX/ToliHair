export default defineEventHandler(async (event) => ({ staff: await readStaff(event) }))
