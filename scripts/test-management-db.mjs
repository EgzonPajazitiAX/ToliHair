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
  const previousLastPosition=(await db.query('select coalesce(max(sort_order),0) as n from public.services')).rows[0].n
  const svc=await save('services',{name:'Management Cut',description:'Test',duration_minutes:30,price_minor:1500,is_active:true})
  assert.equal(svc.sort_order,Math.max(previousLastPosition,0)+1,'New services append after all existing services');checks++
  const existingBarberCount=(await db.query('select count(*)::integer as n from public.barbers')).rows[0].n
  assert.equal((await db.query('select count(*)::integer as n from public.barber_services where service_id=$1',[svc.id])).rows[0].n,existingBarberCount,'New services are assigned to every existing barber');checks++
  await reject('services',{...svc,revision:99},'40001')
  const edited=await save('services',{...svc,price_minor:2000})
  assert.equal(edited.revision,svc.revision+1);checks++
  assert.equal(edited.sort_order,svc.sort_order,'Editing a service preserves its position');checks++
  const alphabeticallyFirst=await save('services',{name:'AAA New Service',description:'Test',duration_minutes:15,price_minor:1000,is_active:true})
  assert.equal(alphabeticallyFirst.sort_order,svc.sort_order+1)
  const ordered=(await db.query('select id from public.services order by sort_order,name')).rows
  assert.equal(ordered.at(-1).id,alphabeticallyFirst.id,'Alphabetically early names still appear last');checks++
  const catalog=(await db.query('select public.get_booking_catalog() as data')).rows[0].data
  assert.equal(catalog.services.at(-1).id,alphabeticallyFirst.id,'The public catalogue uses the append order');checks++
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
  // Whole-shop closures include inactive barbers and use one atomic transaction.
  const inactiveBarber=await save('barbers',{name:'Inactive Closure Barber',bio:'',is_active:false,service_ids:[]})
  const closure=(await db.query('select public.block_all_barbers($1,$2,$3) as rows',['2027-01-08T00:00','2027-01-09T00:00','Holiday'])).rows[0].rows
  assert.equal(closure.length,(await db.query('select count(*)::integer as n from public.barbers')).rows[0].n)
  assert.ok(closure.some(row=>row.barber_id===inactiveBarber.id));checks++
  for(const row of closure) await save('blocked-times',{id:row.id,revision:row.revision,action:'delete'})
  const conflictingAppointment=(await db.query(`select to_char(a.starts_at at time zone s.timezone,'YYYY-MM-DD"T"HH24:MI') as start_local,
    to_char(a.ends_at at time zone s.timezone,'YYYY-MM-DD"T"HH24:MI') as end_local
    from public.appointments a cross join public.shop_settings s where a.status='confirmed' and a.ends_at>now() limit 1`)).rows[0]
  assert.ok(conflictingAppointment)
  const countBefore=(await db.query('select count(*)::integer as n from public.blocked_times')).rows[0].n
  await db.query('savepoint closure_conflict')
  await assert.rejects(db.query('select public.block_all_barbers($1,$2,$3)',[conflictingAppointment.start_local,conflictingAppointment.end_local,'Conflict']),e=>e.code==='23P01');checks++
  await db.query('rollback to savepoint closure_conflict')
  assert.equal((await db.query('select count(*)::integer as n from public.blocked_times')).rows[0].n,countBefore);checks++
  await db.query('savepoint closure_permissions')
  await db.query("select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true)")
  await assert.rejects(db.query('select public.block_all_barbers($1,$2,$3)',['2027-01-08T00:00','2027-01-09T00:00','Holiday']),e=>e.code==='42501');checks++
  await db.query('rollback to savepoint closure_permissions')
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
  // Reordering is atomic, retains names/prices/durations and rejects stale lists.
  const beforeOrder=(await db.query('select id,revision,name,price_minor,duration_minutes from public.services order by sort_order,name')).rows
  const reversed=beforeOrder.toReversed().map(({id,revision})=>({id,revision}))
  await db.query('select public.reorder_services($1)',[JSON.stringify(reversed)])
  const reordered=(await db.query('select id,name,price_minor,duration_minutes from public.services order by sort_order,name')).rows
  assert.deepEqual(reordered,beforeOrder.toReversed().map(({id,name,price_minor,duration_minutes})=>({id,name,price_minor,duration_minutes})));checks++
  assert.deepEqual((await db.query('select public.get_booking_catalog() as data')).rows[0].data.services.map(row=>row.id),reversed.map(row=>row.id));checks++
  await db.query('savepoint stale_order')
  await assert.rejects(db.query('select public.reorder_services($1)',[JSON.stringify(reversed)]),e=>e.code==='40001');checks++
  await db.query('rollback to savepoint stale_order')
  const freshOrder=(await db.query('select id,revision from public.services order by sort_order,name')).rows
  await db.query('savepoint incomplete_order')
  await assert.rejects(db.query('select public.reorder_services($1)',[JSON.stringify(freshOrder.slice(1))]),e=>e.code==='40001');checks++
  await db.query('rollback to savepoint incomplete_order')
  await db.query('savepoint duplicate_order')
  await assert.rejects(db.query('select public.reorder_services($1)',[JSON.stringify([freshOrder[0],freshOrder[0]])]),e=>e.code==='22023');checks++
  await db.query('rollback to savepoint duplicate_order')
  for (const invalid of [null, {}, [null], [{...freshOrder[0],revision:'1'}], [{...freshOrder[0],revision:1.5}], [{...freshOrder[0],extra:true}]]) {
    await db.query('savepoint malformed_order')
    await assert.rejects(db.query('select public.reorder_services($1)',[JSON.stringify(invalid)]),e=>e.code==='22023');checks++
    await db.query('rollback to savepoint malformed_order')
  }
  await db.query('savepoint unauthorized_order')
  await db.query("select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true)")
  await assert.rejects(db.query('select public.reorder_services($1)',[JSON.stringify(freshOrder)]),e=>e.code==='42501');checks++
  await db.query('rollback to savepoint unauthorized_order')
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
