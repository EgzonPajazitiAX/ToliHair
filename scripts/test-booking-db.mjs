import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

// Hardcoded disposable local target. This script never reads production .env.
const connectionString = 'postgresql://postgres@127.0.0.1:55439/tolihair_test'
const db = new pg.Client({ connectionString })
const barber = randomUUID()
const service = randomUUID()
const admin = randomUUID()
let checks = 0
let rejection = 0
async function reject(query, params, code) {
  const savepoint = `rejection_${++rejection}`
  await db.query(`savepoint ${savepoint}`)
  try {
    await assert.rejects(db.query(query, params), error => error.code === code)
    checks++
  }
  finally {
    await db.query(`rollback to savepoint ${savepoint}`)
    await db.query(`release savepoint ${savepoint}`)
  }
}

try {
  await db.connect()
  await db.query('begin')
  await db.query("update public.appointments set status='cancelled' where status='confirmed'")
  await db.query("update public.shop_settings set timezone='UTC',currency='EUR',minimum_notice_minutes=0,booking_horizon_days=365,booking_enabled=false")
  await db.query('insert into auth.users(id) values($1)', [admin])
  await db.query("insert into public.profiles(id,full_name,role,is_active) values($1,'Booking Admin','admin',true)", [admin])
  await db.query("insert into public.services(id,name,duration_minutes,price_minor) values($1,'Test Service',30,2500)", [service])
  await db.query("insert into public.barbers(id,name) values($1,'Test Barber')", [barber])
  await db.query('insert into public.barber_services(barber_id,service_id) values($1,$2) on conflict do nothing', [barber,service])
  await db.query("insert into public.working_hours(barber_id,weekday,start_time,end_time) select $1,d,'08:00','18:00' from generate_series(1,7)d", [barber])

  await db.query('set local role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [admin])
  const revision = (await db.query('select revision from public.shop_settings')).rows[0].revision
  await db.query('select public.set_online_booking(true,$1)', [revision]); checks++
  await db.query('set local role anon')
  const catalog = (await db.query('select public.get_booking_catalog() data')).rows[0].data
  assert.equal(catalog.shop.booking_enabled,true)
  assert.ok(catalog.services.some(row => row.id === service)); checks++
  await reject('select * from public.appointments', [], '42501')
  await reject("select public.create_guest_booking($1,$2,$3,now()+interval '1 day','Guest Name','+36 123456',null)", [randomUUID(),barber,service], '42501')
  await db.query('set local role postgres')

  const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10)
  const slots = (await db.query('select * from public.get_available_slots($1,$2,$3)', [service,tomorrow,barber])).rows
  assert.ok(slots.length > 0); checks++
  const chosen = slots.find(row => row.local_time >= '10:00') || slots[0]
  await db.query("insert into public.blocked_times(barber_id,starts_at,ends_at,reason) values($1,$2,$2::timestamptz+interval '30 minutes','Test block')", [barber,chosen.slot_start])
  const afterBlock = (await db.query('select * from public.get_available_slots($1,$2,$3)', [service,tomorrow,barber])).rows
  assert.ok(!afterBlock.some(row => +new Date(row.slot_start) === +new Date(chosen.slot_start))); checks++

  const bookable = afterBlock[0]
  const key = randomUUID()
  const args = [key,barber,service,bookable.slot_start,'Test Customer','+36 201234567','test@example.com']
  await db.query('set local role service_role')
  const receipt = (await db.query('select public.create_guest_booking($1,$2,$3,$4,$5,$6,$7) data', args)).rows[0].data
  assert.match(receipt.receipt_token,/^[0-9a-f-]{36}$/); checks++
  const repeated = (await db.query('select public.create_guest_booking($1,$2,$3,$4,$5,$6,$7) data', args)).rows[0].data
  assert.equal(repeated.appointment_id,receipt.appointment_id)
  assert.equal(repeated.receipt_token,receipt.receipt_token); checks++
  await reject('select public.create_guest_booking($1,$2,$3,$4,$5,$6,$7)', [...args.slice(0,4),'Another Customer',...args.slice(5)], '23505')
  const loaded = (await db.query('select public.get_guest_booking_receipt($1) data',[receipt.receipt_token])).rows[0].data
  assert.equal(loaded.customer_name,'Test Customer')
  assert.equal(loaded.barber_name,'Test Barber'); checks++
  await db.query('set local role anon')
  await reject('select public.get_guest_booking_receipt($1)',[receipt.receipt_token],'42501')
  await db.query('set local role postgres')

  // Generate slots in UTC so both occurrences of a repeated autumn hour survive.
  await db.query("update public.appointments set status='cancelled' where status='confirmed'; delete from public.blocked_times")
  await db.query("update public.shop_settings set timezone='Europe/Budapest'")
  await db.query("insert into public.working_hours(barber_id,weekday,start_time,end_time) values($1,7,'00:00','05:00')", [barber])
  let year = new Date().getUTCFullYear()
  let autumn = new Date(Date.UTC(year,10,0))
  autumn.setUTCDate(autumn.getUTCDate()-autumn.getUTCDay())
  if (+autumn < Date.now()) { year++; autumn = new Date(Date.UTC(year,10,0)); autumn.setUTCDate(autumn.getUTCDate()-autumn.getUTCDay()) }
  const autumnDate = autumn.toISOString().slice(0,10)
  const repeatedHour = (await db.query("select * from public.get_available_slots($1,$2,$3) where local_time='02:00'",[service,autumnDate,barber])).rows
  assert.equal(repeatedHour.length,2)
  assert.notEqual(+new Date(repeatedHour[0].slot_start),+new Date(repeatedHour[1].slot_start)); checks++

  await db.query('rollback')
  console.log(`${checks} kontrolle të API-së së rezervimeve kaluan.`)
}
catch (error) {
  await db.query('rollback').catch(() => {})
  console.error(error)
  process.exitCode = 1
}
finally { await db.end() }
