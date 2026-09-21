import pg from 'pg'
import { databaseTls } from './db-tls.mjs'

let client
function verify(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { code: 'VERIFICATION_FAILED' })
}
try {
  const target = new URL(process.env.SUPABASE_DB_URL)
  const api = new URL(process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL)
  const project = api.hostname.split('.')[0]
  if (target.hostname !== `db.${api.hostname}` && decodeURIComponent(target.username) !== `postgres.${project}`) {
    throw Object.assign(new Error('Project mismatch'), { code: 'PROJECT_MISMATCH' })
  }
  client = new pg.Client({ connectionString: target.toString(), ssl: databaseTls(target.hostname), connectionTimeoutMillis: 15000 })
  await client.connect()
  await client.query('begin read only')
  const tables = await client.query("select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname")
  const expectedTables = ['appointment_services','appointments','barber_services','barbers','blocked_times','booking_requests','profiles','services','shop_settings','working_hours']
  verify(expectedTables.every(name => tables.rows.some(row => row.name === name && row.rls)), 'Expected tables or RLS are missing')
  console.log('Project connection verified. Public tables:', JSON.stringify(tables.rows))
  const constraints = await client.query("select conname from pg_constraint where conname='appointments_no_overlap'")
  verify(constraints.rowCount === 1, 'Appointment overlap constraint is missing')
  console.log('Appointment overlap constraint:', constraints.rowCount === 1 ? 'present' : 'not present')
  const functions = await client.query("select p.proname, has_function_privilege('anon',p.oid,'execute') as anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_guest_appointment','create_staff_appointment','reschedule_appointment','set_appointment_status') order by p.proname")
  console.log('Scheduling functions:', JSON.stringify(functions.rows))
  const management = await client.query("select has_function_privilege('anon','public.manage_shop(text,jsonb)','execute') as anon_execute, has_function_privilege('authenticated','public.manage_shop(text,jsonb)','execute') as staff_execute")
  verify(!management.rows[0].anon_execute && management.rows[0].staff_execute, 'Management RPC grants are invalid')
  console.log('Management RPC grants (administrator checked inside):', JSON.stringify(management.rows))
  const revisions = await client.query("select table_name from information_schema.columns where table_schema='public' and column_name='revision' and table_name in ('services','barbers','blocked_times','shop_settings') order by table_name")
  verify(revisions.rowCount === 4, 'Management revision columns are incomplete')
  console.log('Management revision columns:', revisions.rowCount)
  const booking = await client.query("select p.proname, has_function_privilege('anon',p.oid,'execute') anon_execute, has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_booking_catalog','get_available_slots','create_guest_booking','get_guest_booking_receipt','set_online_booking') order by p.proname")
  console.log('Booking API function grants:', JSON.stringify(booking.rows))
  const receiptToken = await client.query("select count(*)::integer total from information_schema.columns where table_schema='public' and table_name='booking_requests' and column_name='receipt_token'")
  verify(receiptToken.rows[0].total === 1, 'Protected receipt token column is missing')
  console.log('Protected receipt token column:', receiptToken.rows[0].total === 1 ? 'present' : 'not present')
  const locale = await client.query("select timezone,currency,(select count(id)::integer from public.services) service_count from public.shop_settings where id")
  verify(locale.rows[0]?.timezone === 'Europe/Belgrade' && locale.rows[0]?.currency === 'EUR', 'Kosovo timezone or EUR configuration is invalid')
  console.log('Shop locale and service count:', JSON.stringify(locale.rows[0]))
  const appointments = await client.query("select p.proname, has_function_privilege('anon',p.oid,'execute') anon_execute, has_function_privilege('authenticated',p.oid,'execute') staff_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_staff_appointments','get_staff_available_slots','update_staff_appointment') order by p.proname")
  verify(appointments.rowCount === 3 && appointments.rows.every(row => !row.anon_execute && row.staff_execute), 'Appointment management RPC grants are invalid')
  console.log('Appointment management functions: verified')
  const multiService = await client.query("select p.proname, has_function_privilege('anon',p.oid,'execute') anon_execute, has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_available_slots_multi','create_guest_booking_multi') order by p.proname")
  verify(multiService.rowCount === 2 && multiService.rows.every(row => row.service_execute) && multiService.rows.find(row => row.proname === 'get_available_slots_multi')?.anon_execute, 'Multi-service booking functions or grants are missing')
  console.log('Multi-service booking functions: verified')
  const latest = await client.query("select exists(select 1 from supabase_migrations.schema_migrations where version='20260912000600') applied")
  verify(latest.rows[0].applied, 'Latest application migration is not registered')
  console.log('Latest migration: applied')
  await client.query('commit')
}
catch (error) {
  console.error(`Database verification failed: ${error.code || 'CONFIGURATION_OR_CONNECTION'}. Credentials not logged.`)
  process.exitCode = 1
}
finally { if (client) await client.end() }
