// A mistaken service-role/secret key must never enter a browser bundle.
const publicKey = process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY
if (publicKey) {
  let publicRole = false
  try {
    publicRole = JSON.parse(Buffer.from(publicKey.split('.')[1] || '', 'base64url').toString()).role === 'anon'
  }
  catch { /* Modern publishable keys are not JWTs. */ }
  if (!publicKey.startsWith('sb_publishable_') && !publicRole) {
    throw new Error('SUPABASE_KEY must be a publishable/anon key. Use SUPABASE_SECRET_KEY for private credentials.')
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Nuxt DevTools is intentionally disabled: its build-analysis view can read
  // an incomplete performance entry and throw a misleading `startTime` error.
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  ui: { fonts: false, colorMode: false },
  runtimeConfig: {
    appOrigin: process.env.APP_ORIGIN || '',
    // Private: never move this into public runtime config.
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
    public: {
      siteName: 'Toli Hair',
      supabaseUrl: process.env.SUPABASE_URL || '',
      // Accept only a public key here; validated before Nuxt starts below.
      supabasePublishableKey: process.env.SUPABASE_KEY || '',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'sq' },
      title: 'Toli Hair | Berberhane',
      meta: [{ name: 'description', content: 'Toli Hair. Prerje me kujdes, detaje të pastra dhe kohë e kaluar mirë.' }],
    },
  },
  routeRules: {
    '/dashboard': { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    '/dashboard/**': { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    '/login': { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    '/booking/**': { headers: { 'Cache-Control': 'no-store' } },
    '/api/health': { headers: { 'Cache-Control': 'no-store' } },
  },
})
