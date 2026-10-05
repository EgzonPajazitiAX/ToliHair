import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

// Isolated local fixture only. No .env or production connection is read.
const db = new pg.Client({ connectionString: 'postgresql://postgres@127.0.0.1:55439/tolihair_test' })
const admin = '10000000-0000-0000-0000-000000000001'
const barber = randomUUID()
const short = randomUUID()
const long = randomUUID()
const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
let checks = 0
async function reject(sql, params, code) {
  await db.query('savepoint pricing_rejected')
  await assert.rejects(db.query(sql, params), error => error.code === code)
  await db.query('rollback to savepoint pricing_rejected')
  checks++
}
try {
  await db.connect()
  await db.query('begin')
  await db.query("update public.shop_settings set booking_enabled=true,minimum_notice_minutes=0,peak_pricing_enabled=true,peak_start_time='17:00',peak_end_time='20:00',peak_multiplier=1.50")
  await db.query('insert into public.barbers(id,name) values($1,$2)', [barber, 'Pricing Test Barber'])
  await db.query('insert into public.services(id,name,duration_minutes,price_minor) values($1,$2,5,501),($3,$4,30,1000)', [short, 'Short Test Service', long, 'Long Test Service'])
  await db.query("insert into public.working_hours(barber_id,weekday,start_time,end_time) select $1,d,'08:00','21:00' from generate_series(1,7) d", [barber])
  const instant = async time => (await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' as instant", [date, time])).rows[0].instant.toISOString()
  for (const [time, expected] of [['16:59',501],['17:00',752],['19:59',752],['20:00',501]]) {
    assert.equal((await db.query('select private.price_at(501,$1) as price', [await instant(time)])).rows[0].price, expected)
    checks++
  }
  await reject("update public.shop_settings set peak_start_time='20:00',peak_end_time='17:00'", [], '23514')
  await reject('update public.shop_settings set peak_multiplier=0.5', [], '23514')
  await db.query('set local role anon')
  await reject('select private.price_at(501,$1)', [await instant('17:00')], '42501')
  const starts = (await db.query('select * from public.get_booking_start_slots($1,$2)', [date, barber])).rows
  assert.ok(starts.some(item => item.local_time === '17:00' && item.service_ids.includes(short) && item.service_ids.includes(long))); checks++
  assert.ok(starts.some(item => item.local_time === '20:45' && item.service_ids.includes(short) && !item.service_ids.includes(long))); checks++
  await reject('select public.create_guest_booking_priced($1,$2,$3,$4,$5,$6,null,$7)', [randomUUID(),barber,[short],await instant('17:00'),'Pricing Client','00000001',752], '42501')
  await db.query('reset role; set local role service_role')
  const key = randomUUID()
  const args = [key,barber,[short,long],await instant('17:00'),'Pricing Client','00000001',2252]
  const bookingSql = 'select public.create_guest_booking_priced($1,$2,$3,$4,$5,$6,null,$7) as receipt'
  await reject(bookingSql, [randomUUID(),barber,[short,long],await instant('17:00'),'Pricing Client','00000001',1501], '40001')
  const receipt = (await db.query(bookingSql, args)).rows[0].receipt
  assert.equal(receipt.price_minor,2252); assert.equal(receipt.duration_minutes,35); checks++
  await db.query('reset role')
  const parts = (await db.query('select price_minor from public.appointment_services where appointment_id=$1 order by position', [receipt.appointment_id])).rows
  assert.deepEqual(parts.map(item => item.price_minor),[752,1500]); checks++
  await db.query('set local role service_role')
  await reject(bookingSql,[randomUUID(),barber,[short],await instant('17:15'),'Overlap Client','00000002',752],'23P01')
  const single = (await db.query(bookingSql,[randomUUID(),barber,[short],await instant('18:00'),'Single Client','00000003',752])).rows[0].receipt
  assert.equal(single.price_minor,752); checks++
  await db.query('reset role')
  await db.query('update public.shop_settings set peak_multiplier=2')
  await db.query('set local role service_role')
  assert.equal((await db.query(bookingSql,args)).rows[0].receipt.price_minor,2252); checks++
  await db.query('reset role')
  assert.equal((await db.query('select price_minor from public.appointments where id=$1',[single.appointment_id])).rows[0].price_minor,752); checks++
  // Use the actual staff RPCs, not direct UPDATEs: both entry points must reprice.
  await db.query('set local role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin])
  const updateSql = 'select public.update_staff_appointment($1,$2,$3,$4,$5,$6,$7,null) as appointment'
  let version = (await db.query('select version from public.appointments where id=$1',[single.appointment_id])).rows[0].version
  let edited = (await db.query(updateSql,[single.appointment_id,version,barber,short,await instant('18:00'),'Contact Edit','00000003'])).rows[0].appointment
  assert.equal(edited.price_minor,752); checks++ // Settings changed to 2x, but contact-only preserves quote.
  edited = (await db.query(updateSql,[single.appointment_id,edited.version,barber,short,await instant('09:00'),'Contact Edit','00000003'])).rows[0].appointment
  assert.equal(edited.price_minor,501); checks++
  await reject(updateSql,[single.appointment_id,version,barber,short,await instant('19:00'),'Stale Edit','00000003'],'40001')
  edited = (await db.query(updateSql,[single.appointment_id,edited.version,barber,short,await instant('19:00'),'Contact Edit','00000003'])).rows[0].appointment
  assert.equal(edited.price_minor,1002); checks++
  edited = (await db.query(updateSql,[single.appointment_id,edited.version,barber,long,await instant('19:00'),'Contact Edit','00000003'])).rows[0].appointment
  assert.equal(edited.price_minor,2000); assert.equal(edited.duration_minutes,30); checks++
  await db.query('reset role')
  assert.deepEqual((await db.query('select price_minor from public.appointment_services where appointment_id=$1',[single.appointment_id])).rows.map(item=>item.price_minor),[2000]); checks++
  await db.query('update public.shop_settings set peak_multiplier=1.5')
  await db.query('set local role authenticated')
  version = (await db.query('select version from public.appointments where id=$1',[receipt.appointment_id])).rows[0].version
  let multi = (await db.query('select to_jsonb(public.reschedule_appointment($1,$2,$3,$4)) as appointment',[receipt.appointment_id,version,barber,await instant('10:00')])).rows[0].appointment
  assert.equal(multi.price_minor,1501); assert.equal(multi.duration_minutes,35); checks++
  multi = (await db.query(updateSql,[multi.id,multi.version,barber,short,await instant('18:00'),'Multi Edit','00000001'])).rows[0].appointment
  assert.equal(multi.price_minor,2252); assert.equal(multi.duration_minutes,35); checks++
  await db.query('reset role')
  assert.deepEqual((await db.query('select price_minor from public.appointment_services where appointment_id=$1 order by position',[multi.id])).rows.map(item=>item.price_minor),[752,1500]); checks++
  await db.query('set local role authenticated')
  await reject(updateSql,[multi.id,multi.version,barber,short,await instant('19:00'),'Overlap Edit','00000001'],'23P01')
  await db.query('reset role')
  assert.equal((await db.query('select price_minor from public.appointments where id=$1',[multi.id])).rows[0].price_minor,2252); checks++
  assert.deepEqual((await db.query('select price_minor from public.appointment_services where appointment_id=$1 order by position',[multi.id])).rows.map(item=>item.price_minor),[752,1500]); checks++
  await db.query('reset role')
  await db.query("update public.profiles set role='admin' where id=$1",[admin])
  await db.query('set local role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin])
  const cfg = (await db.query('select * from public.shop_settings')).rows[0]
  const payload = { revision:cfg.revision,name:cfg.name,phone:'',address:'',timezone:cfg.timezone,currency:cfg.currency,minimum_notice_minutes:0,slot_interval_minutes:15,booking_horizon_days:60,peak_pricing_enabled:false,peak_start_time:'17:00',peak_end_time:'20:00',peak_multiplier:1.5 }
  await db.query("select public.manage_shop('settings',$1)",[JSON.stringify(payload)])
  const catalog = (await db.query('select public.get_booking_catalog() as catalog')).rows[0].catalog
  assert.equal(catalog.shop.peak_pricing_enabled,false); assert.equal(catalog.shop.peak_multiplier,1.5); checks++
  await reject("select public.manage_shop('settings',$1)",[JSON.stringify(payload)],'40001')
  await db.query('reset role')
  assert.equal((await db.query('select private.price_at(501,$1) as price',[await instant('18:00')])).rows[0].price,501); checks++
  await db.query('update public.services set price_minor=600 where id=$1',[short])
  await db.query('set local role authenticated')
  const disabledEdit = (await db.query(updateSql,[multi.id,multi.version,barber,short,await instant('18:15'),'Multi Edit','00000001'])).rows[0].appointment
  assert.equal(disabledEdit.price_minor,1600); checks++ // New base prices, no premium when disabled.
  await db.query('reset role')
  assert.deepEqual((await db.query('select price_minor from public.appointment_services where appointment_id=$1 order by position',[multi.id])).rows.map(item=>item.price_minor),[600,1000]); checks++
  await db.query("update public.profiles set role='staff' where id=$1",[admin])
  await db.query('set local role authenticated')
  await reject("select public.manage_shop('settings',$1)",[JSON.stringify(payload)],'42501')
  console.log(`${checks} time-pricing database checks passed (boundaries, roles, rounded totals, conflicts, snapshots, retries, revisions).`)
}
finally { await db.query('rollback').catch(() => {}); await db.end() }
