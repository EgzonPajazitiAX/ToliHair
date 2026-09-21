const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY
if (!url || !key) { console.error('Supabase URL/public key missing. See .env.example.'); process.exit(1) }
try {
  const result = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key }, signal: AbortSignal.timeout(15000) })
  console.log(`Supabase Auth: HTTP ${result.status}`)
  if (!result.ok) process.exitCode = 1
  // Reachability is not proof of migrations or a staff session.
  if (result.ok) console.log('Connection verified. Database migrations and authentication setup are separate steps.')
}
catch { console.error('Connection check failed; credentials were not logged.'); process.exitCode = 1 }
