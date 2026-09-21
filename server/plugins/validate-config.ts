// Check again at server startup: production environment overrides can differ from build.
export default defineNitroPlugin(() => {
  const config = serverEnvironment()
  const key = config.supabasePublishableKey
  if (process.env.NODE_ENV === 'production') {
    const missing = [
      !config.supabaseUrl && 'NUXT_PUBLIC_SUPABASE_URL',
      !key && 'NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      !config.supabaseSecretKey && 'NUXT_SUPABASE_SECRET_KEY',
      !config.appOrigin && 'NUXT_APP_ORIGIN',
    ].filter(Boolean)
    if (missing.length) {
      throw new Error(`Production configuration is incomplete. Missing: ${missing.join(', ')}.`)
    }
    const origin = new URL(config.appOrigin)
    if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) {
      throw new Error('APP_ORIGIN must use HTTPS in production.')
    }
  }
  if (!key) return
  let isAnon = false
  try { isAnon = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role === 'anon' }
  catch { /* Publishable keys are not JWTs. */ }
  if (!key.startsWith('sb_publishable_') && !isAnon) {
    throw new Error('Public Supabase configuration contains a non-public key. Refusing to start.')
  }

  const secret = config.supabaseSecretKey
  if (secret) {
    let isServiceRole = false
    try { isServiceRole = JSON.parse(Buffer.from(secret.split('.')[1] || '', 'base64url').toString()).role === 'service_role' }
    catch { /* Secret keys are not JWTs. */ }
    if (!secret.startsWith('sb_secret_') && !isServiceRole) {
      throw new Error('Private Supabase configuration is invalid. Refusing to start.')
    }
  }
})
