// Check again at server startup: production environment overrides can differ from build.
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const key = config.public.supabasePublishableKey
  if (process.env.NODE_ENV === 'production') {
    if (!config.public.supabaseUrl || !key || !config.supabaseSecretKey || !config.appOrigin) {
      throw new Error('Production configuration is incomplete. Refusing to start.')
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
