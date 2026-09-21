import type { H3Event } from 'h3'

export async function readLimitedJson(event: H3Event, maximumBytes: number): Promise<unknown> {
  const declared = Number(getHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > maximumBytes) throw createError({ statusCode: 413, statusMessage: 'Kërkesa është shumë e madhe' })
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumBytes) {
      event.node.req.resume()
      throw createError({ statusCode: 413, statusMessage: 'Kërkesa është shumë e madhe' })
    }
    chunks.push(buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Kërkesë JSON e pavlefshme' }) }
}
