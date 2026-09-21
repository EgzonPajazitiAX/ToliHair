import type { H3Event } from 'h3'

export function requireSameOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  const expected = serverEnvironment(event).appOrigin || getRequestURL(event, { xForwardedHost: false, xForwardedProto: false }).origin
  if (!origin || origin !== expected || getHeader(event, 'x-toli-request') !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'Origjina e kërkesës u refuzua' })
  }
  if (!getHeader(event, 'content-type')?.toLowerCase().startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Kërkohet kërkesë në formatin JSON' })
  }
}
