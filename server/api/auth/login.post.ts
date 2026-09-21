import { loginSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  limitLogin(event)
  if (Number(getHeader(event, 'content-length')) > 4096) throw createError({ statusCode: 413, statusMessage: 'Kërkesa është shumë e madhe' })
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) {
      event.node.req.resume()
      throw createError({ statusCode: 413, statusMessage: 'Kërkesa është shumë e madhe' })
    }
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  let input: unknown
  try { input = JSON.parse(raw) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Kërkesë JSON e pavlefshme' }) }
  const body = loginSchema.safeParse(input)
  if (!body.success) throw createError({ statusCode: 422, statusMessage: 'Shkruani email dhe fjalëkalim të vlefshëm' })
  const client = sessionClient(event)
  const { error } = await client.auth.signInWithPassword(body.data)
  if (error) {
    if (error.status === 429) {
      setHeader(event, 'Retry-After', 60)
      throw createError({ statusCode: 429, statusMessage: 'Shumë tentativa për hyrje. Ju lutemi provoni përsëri më vonë.' })
    }
    throw createError({ statusCode: error.status && error.status >= 500 ? 503 : 401, statusMessage: 'Hyrja dështoi. Kontrolloni të dhënat ose kontaktoni administratorin.' })
  }
  try {
    const staff = await readStaff(event)
    if (!staff) throw createError({ statusCode: 401, statusMessage: 'Hyrja dështoi. Kontrolloni të dhënat ose kontaktoni administratorin.' })
    return { staff }
  }
  catch (error) {
    await client.auth.signOut({ scope: 'local' })
    clearStaffCookies(event)
    throw error
  }
})
