import pg from 'pg'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Run after db:test in the same disposable local database. Entire suite rolls back.
const db = new pg.Client({ connectionString: 'postgresql://postgres@127.0.0.1:55439/tolihair_test' })
let checks=0
async function reject(resource,data,code) {
  await db.query('savepoint rejected_operation')
  await assert.rejects(db.query('select public.manage_shop($1,$2)',[resource,data]), e=>e.code===code)
  await db.query('rollback to savepoint rejected_operation');checks++
}
async function save(resource,data) { const r=await db.query('select public.manage_shop($1,$2) as row',[resource,data]);checks++;return r.rows[0].row }
try {
  await db.connect();await db.query('begin')
  const admin=randomUUID()
  await db.query('insert into auth.users(id) values($1)',[admin])
  await db.query("insert into public.profiles(id,full_name,role,is_active) values($1,'Test Admin','admin',true)",[admin])
  await db.query('set local role anon')
  await reject('services',{},'42501')
  await db.query('reset role; set local role authenticated')
  await db.query("select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true)")
  await reject('services',{},'42501')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin])
  const svc=await save('services',{name:'Management Cut',description:'Test',duration_minutes:30,price_minor:1500,is_active:true})
  const existingBarberCount=(await db.query('select count(*)::integer as n from public.barbers')).rows[0].n
  assert.equal((await db.query('select count(*)::integer as n from public.barber_services where service_id=$1',[svc.id])).rows[0].n,existingBarberCount,'New services are assigned to every existing barber');checks++
  await reject('services',{...svc,revision:99},'40001')
  const edited=await save('services',{...svc,price_minor:2000})
  assert.equal(edited.revision,svc.revision+1);checks++
  await reject('services',{...edited,duration_minutes:0},'23514')
  const barber=await save('barbers',{name:'Management Barber',bio:'',is_active:true,service_ids:[]})
  const serviceCount=(await db.query('select count(*)::integer as n from public.services')).rows[0].n
  await db.query('set constraints all immediate')
  assert.equal((await db.query('select count(*)::integer as n from public.barber_services where barber_id=$1',[barber.id])).rows[0].n,serviceCount,'New barbers receive every service even when the legacy list is empty');checks++
  await db.query('set constraints all deferred')
  let schedule=await save('working-hours',{id:barber.id,revision:barber.revision,intervals:[{weekday:1,start_time:'09:00',end_time:'12:00'},{weekday:1,start_time:'13:00',end_time:'17:00'}]})
  await reject('working-hours',{id:barber.id,revision:schedule.revision,intervals:[{weekday:1,start_time:'09:00',end_time:'12:00'},{weekday:1,start_time:'11:00',end_time:'17:00'}]},'23P01')
  assert.equal((await db.query('select count(*)::integer as n from public.working_hours where barber_id=$1',[barber.id])).rows[0].n,2);checks++
  const block=await save('blocked-times',{barber_id:barber.id,start_local:'2027-01-04T00:00',end_local:'2027-01-05T00:00',reason:'Day off'})
  await reject('blocked-times',{id:block.id,revision:99,action:'delete'},'40001')
  await save('blocked-times',{...block,start_local:'2027-01-04T00:00',end_local:'2027-01-06T00:00',reason:'Vacation'})
  await save('blocked-times',{id:block.id,revision:block.revision+1,action:'delete'})
  let cfg=(await db.query('select * from public.shop_settings')).rows[0]
  delete cfg.id
  await reject('settings',{...cfg,currency:'USD'},'22023')
  cfg=await save('settings',{...cfg,name:'Test Updated Shop'})
  delete cfg.id
  assert.equal(cfg.booking_enabled,true,'Configuration RPC cannot silently disable existing booking');checks++
  assert.equal(cfg.timezone,'Europe/Belgrade');assert.equal(cfg.currency,'EUR');checks++
  await reject('settings',{...cfg,revision:1},'40001')
  // Replace hours without invalidating a confirmed appointment in the intermediate
  // DELETE statement. The final schedule is what the deferred trigger validates.
  const existing=(await db.query("select * from public.appointments where status='confirmed' limit 1")).rows[0]
  const existingBarber=(await db.query('select * from public.barbers where id=$1',[existing.barber_id])).rows[0]
  const week=(await db.query('select weekday,start_time,end_time from public.working_hours where barber_id=$1',[existing.barber_id])).rows
  await save('working-hours',{id:existingBarber.id,revision:existingBarber.revision,intervals:week})
  await db.query('set constraints all immediate');checks++
  await reject('barbers',{...existingBarber,revision:existingBarber.revision+1,is_active:false,service_ids:[existing.service_id]},'22023')
  // Deferred validation still rejects invalid final changes on commit/check.
  await db.query('set constraints all deferred; savepoint schedule_conflict')
  const current=(await db.query('select revision from public.barbers where id=$1',[existingBarber.id])).rows[0]
  await save('working-hours',{id:existingBarber.id,revision:current.revision,intervals:[]})
  await assert.rejects(db.query('set constraints all immediate'),e=>e.code==='22023');checks++
  await db.query('rollback to savepoint schedule_conflict')
  // Reject nonexistent and repeated clock-change local times.
  await db.query('reset role')
  await db.query("update public.appointments set status='cancelled' where status='confirmed'")
  await db.query('delete from public.blocked_times')
  await db.query("update public.shop_settings set timezone='Europe/Budapest'")
  await db.query('set local role authenticated')
  await reject('blocked-times',{barber_id:barber.id,start_local:'2027-03-28T02:30',end_local:'2027-03-28T04:00',reason:''},'22023')
  await reject('blocked-times',{barber_id:barber.id,start_local:'2026-10-25T02:30',end_local:'2026-10-25T04:00',reason:''},'22023')
  console.log(`${checks} management database checks passed.`)
}
finally { await db.query('rollback').catch(()=>{});await db.end() }
