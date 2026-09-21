import { managementResource, managementSchemas } from '#shared/schemas/management'
import { saveManagement, synchronizeUniversalBarberServices } from '../../repositories/management'

export default defineEventHandler(async (event) => {
  await requireStaff(event, true)
  requireSameOrigin(event)
  const resource = managementResource.safeParse(getRouterParam(event, 'resource'))
  if (!resource.success) throw createError({ statusCode: 404, statusMessage: 'Faqja nuk u gjet' })
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 32768) { event.node.req.resume(); throw createError({ statusCode: 413, statusMessage: 'Kërkesa është shumë e madhe' }) }
    chunks.push(buffer)
  }
  let input: unknown
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw createError({ statusCode: 400, statusMessage: 'JSON i pavlefshëm' }) }
  const parsed = managementSchemas[resource.data].safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Kontrolloni vlerat e formularit', data: { issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: 'Kjo vlerë nuk është e vlefshme' })) } })
  const result = await saveManagement(sessionClient(event), resource.data, parsed.data)
  if (resource.data === 'services' || resource.data === 'barbers') {
    await synchronizeUniversalBarberServices(createPrivilegedSupabaseClient())
  }
  return result
})
