import type { H3Event } from 'h3'

function environmentValue(...values: Array<string | undefined>) {
  return values.find(value => value?.trim())?.trim() || ''
}

export function serverEnvironment(event?: H3Event) {
  const config = useRuntimeConfig(event)
  return {
    supabaseUrl: environmentValue(
      process.env.NUXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
      config.public.supabaseUrl,
    ),
    supabasePublishableKey: environmentValue(
      process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_KEY,
      config.public.supabasePublishableKey,
    ),
    supabaseSecretKey: environmentValue(
      process.env.NUXT_SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SECRET_KEY,
      config.supabaseSecretKey,
    ),
    appOrigin: environmentValue(
      process.env.NUXT_APP_ORIGIN,
      process.env.APP_ORIGIN,
      config.appOrigin,
    ),
  }
}
