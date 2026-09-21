import pg from 'pg'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const db = new pg.Client({ connectionString: 'postgresql://postgres@127.0.0.1:55439/tolihair_test' })
const staff = '10000000-0000-0000-0000-000000000001'
const inactive = '10000000-0000-0000-0000-000000000002'
const barber = '20000000-0000-0000-0000-000000000001'
const service = '30000000-0000-0000-0000-000000000001'
let checks = 0
async function rejected(sql, params, code) {
  await db.query('savepoint rejected_operation')
  await assert.rejects(db.query(sql, params), error => error.code === code)
  await db.query('rollback to savepoint rejected_operation')
  checks++
}

try {
  await db.connect()
  await db.query('begin; set local role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [inactive])
  const testDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  await rejected('select * from public.get_staff_available_slots($1,$2,$3,$4)', [service, testDate, barber, null], '42501')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff])
  await rejected('select * from public.get_staff_appointments($1,$2,$3,$4,$5)', [testDate, testDate, null, null, null], '22023')

  const slots = (await db.query('select * from public.get_staff_available_slots($1,$2,$3,$4)', [service, testDate, barber, null])).rows
  assert.ok(slots.length > 0); checks++
  const start = slots.at(-1).slot_start
  const created = (await db.query('select (public.create_staff_appointment($1,$2,$3,$4,$5,$6,$7)).*', [randomUUID(), barber, service, start, 'Klienti Testues', '+383 44 111 222', 'test@example.com'])).rows[0]
  assert.equal(created.source, 'staff'); checks++

  const listed = (await db.query('select * from public.get_staff_appointments($1,$2,$3,$4,$5)', [testDate, new Date(new Date(`${testDate}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10), barber, 'confirmed', 'Klienti Testues'])).rows
  assert.ok(listed.some(item => item.id === created.id)); checks++
  const editingSlots = (await db.query('select * from public.get_staff_available_slots($1,$2,$3,$4)', [service, testDate, barber, created.id])).rows
  assert.ok(editingSlots.some(item => new Date(item.slot_start).toISOString() === new Date(start).toISOString())); checks++

  const editable = (await db.query('select id,version,status,starts_at>now() as future from public.appointments where id=$1', [created.id])).rows[0]
  assert.deepEqual(editable, { id: created.id, version: created.version, status: 'confirmed', future: true }); checks++
  const edited = (await db.query('select public.update_staff_appointment($1,$2,$3,$4,$5,$6,$7,$8) as appointment', [created.id, created.version, barber, service, start, 'Klienti i Ndryshuar', '+383 44 333 444', null])).rows[0].appointment
  assert.equal(edited.id, created.id); assert.equal(edited.customer_name, 'Klienti i Ndryshuar'); assert.equal(edited.version, created.version + 1); checks++
  const afterEdit = (await db.query('select version,status,customer_name from public.appointments where id=$1', [created.id])).rows[0]
  assert.deepEqual(afterEdit, { version: edited.version, status: 'confirmed', customer_name: edited.customer_name }); checks++
  const cancelled = (await db.query("select public.set_appointment_status($1,$2,'cancelled') as appointment", [edited.id, edited.version])).rows[0].appointment
  assert.equal(cancelled.status, 'cancelled'); checks++
  await rejected('select public.update_staff_appointment($1,$2,$3,$4,$5,$6,$7,$8)', [created.id, created.version, barber, service, start, 'Vjetër', '+383 44 333 444', null], '40001')
  await rejected('select public.update_staff_appointment($1,$2,$3,$4,$5,$6,$7,$8)', [created.id, cancelled.version, barber, service, start, 'Final', '+383 44 333 444', null], '40001')
  console.log(`${checks} appointment-management database checks passed.`)
}
finally { await db.query('rollback').catch(() => {}); await db.end() }
