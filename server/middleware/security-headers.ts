export default defineEventHandler((event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
  setHeader(event, 'X-DNS-Prefetch-Control', 'off')
  setHeader(event, 'Origin-Agent-Cluster', '?1')

  const origin = serverEnvironment(event).appOrigin
  if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
