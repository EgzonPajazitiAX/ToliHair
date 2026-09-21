import pg from 'pg'
import { databaseTls } from './db-tls.mjs'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) { console.error('Usage: node --env-file=.env scripts/staff-account.mjs email [--activate-admin]'); process.exit(1) }
let client
try {
  const target = new URL(process.env.SUPABASE_DB_URL)
  const project = new URL(process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  if (target.hostname !== `db.${project}.supabase.co` && decodeURIComponent(target.username) !== `postgres.${project}`) throw new Error('Project mismatch')
  client = new pg.Client({ connectionString: target.toString(), ssl: databaseTls(target.hostname), connectionTimeoutMillis: 15000 })
  await client.connect()
  const result = await client.query('select id, email_confirmed_at is not null as confirmed from auth.users where lower(email)=$1', [email])
  if (result.rowCount !== 1) {
    console.log('No matching Auth account. Create it in Supabase Authentication > Users > Add user (Create new user, auto-confirm), then run again.')
    process.exitCode = 2
  }
  else if (!result.rows[0].confirmed) {
    console.log('Auth account exists but email is not confirmed. Confirm ownership before activating staff access.')
    process.exitCode = 2
  }
  else if (process.argv.includes('--activate-admin')) {
    await client.query("insert into public.profiles(id,full_name,role,is_active) values($1,$2,'admin',true) on conflict(id) do update set role='admin',is_active=true", [result.rows[0].id, 'Toli Hair Administrator'])
    console.log('Administrator profile activated for the specified existing Auth account.')
  }
  else console.log('Confirmed Auth account exists. Ready for administrator activation.')
}
catch (error) { console.error(`Staff setup failed: ${error.code || 'CONFIGURATION_OR_CONNECTION'}. Credentials not logged.`); process.exitCode = 1 }
finally { if (client) await client.end() }
