import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import pg from 'pg'

// Hardcoded local disposable target by design. Never read production .env here.
const connectionString = 'postgresql://postgres@127.0.0.1:55439/tolihair_test'
const db = new pg.Client({ connectionString })
const second = new pg.Client({ connectionString })
const staff = '10000000-0000-0000-0000-000000000001'
const inactive = '10000000-0000-0000-0000-000000000002'
const barber = '20000000-0000-0000-0000-000000000001'
const service = '30000000-0000-0000-0000-000000000001'
let checks = 0
async function reject(query, params, code) {
  await assert.rejects(db.query(query, params), error => error.code === code)
  checks++
}
const createSql = 'select (public.create_guest_appointment($1,$2,$3,$4,$5,$6,$7)).id'
const start = new Date(); start.setUTCDate(start.getUTCDate() + 2); start.setUTCHours(10, 0, 0, 0)
const at = minutes => new Date(+start + minutes * 60000).toISOString()
const args = (minutes = 0, key = randomUUID()) => [key, barber, service, at(minutes), 'Test Customer', '+36 20 123 4567', null]
try {
  await db.connect(); await second.connect()
  const existing = await db.query("select to_regclass('public.appointments') as table_name")
  assert.equal(existing.rows[0].table_name, null, 'Use a fresh disposable test container; this script never resets a database.')
  await db.query(await readFile(new URL('../supabase/tests/bootstrap.sql', import.meta.url), 'utf8'))
  const folder = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort()) {
    await db.query('begin')
    try { await db.query(await readFile(new URL(file, folder), 'utf8')); await db.query('commit') }
    catch (error) { await db.query('rollback'); throw error }
    console.log(`Migration valid: ${file}`)
  }
  await db.query("update public.shop_settings set timezone='UTC',currency='EUR',booking_enabled=true")
  await db.query('insert into auth.users(id) values($1),($2)', [staff, inactive])
  await db.query("insert into public.profiles(id,full_name,role,is_active) values($1,'Test Staff','staff',true),($2,'Inactive Staff','staff',false)", [staff,inactive])
  await db.query("insert into public.barbers(id,name) values($1,'Test Barber')", [barber])
  await db.query("insert into public.services(id,name,duration_minutes,price_minor) values($1,'Test Cut',30,2500)", [service])
  await db.query('insert into public.barber_services values($1,$2) on conflict do nothing', [barber,service])
  await db.query("insert into public.working_hours(barber_id,weekday,start_time,end_time) select $1,d,'08:00','20:00' from generate_series(1,7) d", [barber])
  await reject("insert into public.working_hours(barber_id,weekday,start_time,end_time) values($1,1,'09:00','10:00')", [barber], '23P01')
  await db.query("update public.shop_settings set timezone='Not/AZone',currency='USD'")
  const fixedLocale = (await db.query('select timezone,currency from public.shop_settings')).rows[0]
  assert.deepEqual(fixedLocale,{timezone:'Europe/Belgrade',currency:'EUR'}); checks++

  // Two connections: transaction 2 waits for transaction 1 then fails overlap.
  await db.query('begin')
  const originalArgs = args()
  const appointment = (await db.query(createSql, originalArgs)).rows[0].id
  const racing = second.query(createSql, args()).then(() => 'unexpected success', error => error.code)
  await db.query('select pg_sleep(0.2)')
  await db.query('commit')
  assert.equal(await racing, '23P01'); checks++
  assert.equal((await db.query(createSql, originalArgs)).rows[0].id, appointment); checks++
  const secondService = randomUUID()
  await db.query("insert into public.services(id,name,duration_minutes,price_minor) values($1,'Beard Detail',20,1200)",[secondService])
  const multiSlots = await db.query('select * from public.get_available_slots_multi($1,$2,$3)',[[service,secondService],start.toISOString().slice(0,10),barber])
  assert.ok(multiSlots.rows.some(row => new Date(row.slot_start).toISOString()===at(60))); checks++
  const multi = (await db.query('select public.create_guest_booking_multi($1,$2,$3,$4,$5,$6,$7) as receipt',[
    randomUUID(),barber,[service,secondService],at(60),'Multi Customer','+36 20 765 4321',null,
  ])).rows[0].receipt
  assert.equal(multi.duration_minutes,50); assert.equal(multi.price_minor,3700); checks++
  assert.equal((await db.query('select count(*)::integer as n from public.appointment_services where appointment_id=$1',[multi.appointment_id])).rows[0].n,2); checks++
  const changed = [...originalArgs]; changed[4] = 'Another Person'
  await reject(createSql, changed, '23505')
  await reject(createSql, args(15), '23P01')
  await db.query(createSql, args(30)); checks++ // End-exclusive adjacency allowed.
  await reject(createSql, args(5), '22023')
  await reject(createSql, args(8 * 60), '22023') // Closing boundary.
  await reject("insert into public.blocked_times(barber_id,starts_at,ends_at) values($1,$2,$3)", [barber,at(0),at(30)], '23P01')
  await reject('delete from public.working_hours where barber_id=$1', [barber], '22023')
  await reject('update public.barbers set is_active=false where id=$1', [barber], '22023')
  await db.query('update public.services set price_minor=9999,duration_minutes=45 where id=$1', [service])
  const snapshot = (await db.query('select price_minor,duration_minutes from public.appointments where id=$1', [appointment])).rows[0]
  assert.deepEqual(snapshot, { price_minor: 2500, duration_minutes: 30 }); checks++

  // RLS and grants: guests cannot read/write PII or invoke booking RPC directly.
  await db.query('set role anon')
  await reject('select * from public.appointments', [], '42501')
  await reject(createSql, args(90), '42501')
  await db.query('reset role; set role authenticated')
  assert.equal((await db.query('select * from public.appointments')).rowCount, 0); checks++
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [inactive])
  await reject('select public.set_appointment_status($1,1,\'cancelled\')', [appointment], '42501')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [staff])
  assert.equal((await db.query('select * from public.appointments')).rowCount, 3); checks++
  await reject('update public.profiles set role=\'admin\' where id=$1', [staff], '42501')
  await reject('update public.appointments set price_minor=0', [], '42501')
  await reject('select public.set_appointment_status($1,99,\'cancelled\')', [appointment], '40001')
  await reject('select public.set_appointment_status($1,1,\'completed\')', [appointment], '22023')
  await db.query('select public.reschedule_appointment($1,1,$2,$3)', [appointment,barber,at(120)]); checks++
  await db.query('select public.set_appointment_status($1,2,\'cancelled\')', [appointment]); checks++
  await db.query('reset role')
  // Cancellation frees the original rescheduled interval.
  await db.query(createSql, args(120)); checks++
  await db.query("insert into public.blocked_times(barber_id,starts_at,ends_at) values($1,$2,$3)", [barber,at(180),at(240)])
  await reject(createSql,args(180),'23P01')
  // A block transaction racing a booking is also serialized.
  await db.query('begin')
  await db.query("insert into public.blocked_times(barber_id,starts_at,ends_at) values($1,$2,$3)", [barber,at(300),at(360)])
  const blockRace = second.query(createSql,args(300)).then(()=>'unexpected success', error=>error.code)
  await db.query('select pg_sleep(0.2)')
  await db.query('commit')
  assert.equal(await blockRace,'23P01'); checks++
  await db.query('set role service_role')
  await db.query(createSql,args(390)); checks++
  await db.query('reset role')
  // Calendar boundaries: the repeated autumn hour represents distinct instants,
  // and a spring appointment may span the missing wall-clock hour.
  await db.query('begin')
  await db.query("update public.appointments set status='cancelled' where status='confirmed'")
  await db.query("update public.shop_settings set timezone='Europe/Budapest',booking_horizon_days=365,minimum_notice_minutes=0")
  const dstBarber = randomUUID()
  await db.query("insert into public.barbers(id,name) values($1,'DST Barber')", [dstBarber])
  await db.query('insert into public.barber_services values($1,$2) on conflict do nothing', [dstBarber,service])
  await db.query("insert into public.working_hours(barber_id,weekday,start_time,end_time) values($1,7,'00:00','05:00')", [dstBarber])
  const nextTransition = month => {
    let year = new Date().getUTCFullYear()
    let date = new Date(Date.UTC(year, month + 1, 0))
    date.setUTCDate(date.getUTCDate() - date.getUTCDay())
    if (+date < Date.now()) {
      year++; date = new Date(Date.UTC(year, month + 1, 0)); date.setUTCDate(date.getUTCDate() - date.getUTCDay())
    }
    return date
  }
  const spring = nextTransition(2); spring.setUTCHours(0,30,0,0)
  await db.query(createSql,[randomUUID(),dstBarber,service,spring.toISOString(),'Spring Customer','+36 20 1234567',null]); checks++
  const autumn = nextTransition(9)
  for (const hour of [0,1]) {
    autumn.setUTCHours(hour,0,0,0)
    await db.query(createSql,[randomUUID(),dstBarber,service,autumn.toISOString(),'Autumn Customer','+36 20 1234567',null]); checks++
  }
  await db.query('rollback')
  const protectedTables = await db.query("select count(*)::integer as total from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity")
  assert.equal(protectedTables.rows[0].total,10); checks++
  console.log(`${checks} database assertions passed (constraints, RPC, RLS, snapshots, retries, concurrency).`)
}
catch (error) { console.error(error); process.exitCode = 1 }
finally { await db.end(); await second.end() }
