import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

function connection() {
  const config = serverEnvironment()
  if (!config.supabaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'Lidhja me bazën e të dhënave nuk është konfiguruar' })
  }
  return config
}

// No implicit session singleton. Staff requests will use their verified JWT in Phase 4.
export function createPublicSupabaseClient() {
  const config = connection()
  if (!config.supabasePublishableKey) {
    throw createError({ statusCode: 503, statusMessage: 'Lidhja me bazën e të dhënave nuk është konfiguruar' })
  }
  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// Bypasses RLS. Call only from explicitly authorized server workflows, never a browser.
export function createPrivilegedSupabaseClient() {
  const config = connection()
  if (!config.supabaseSecretKey) {
    throw createError({ statusCode: 503, statusMessage: 'Qasja e privilegjuar në bazën e të dhënave nuk është konfiguruar' })
  }
  return createClient<Database>(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
