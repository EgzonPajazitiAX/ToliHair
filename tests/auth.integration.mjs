import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

// Runs the production app against an isolated HTTP Supabase fixture, never the
// hosted project. Exercises real SDK cookies/refresh, routing, CSRF and role checks.
const users = new Map(['admin', 'staff', 'inactive', 'outsider'].map(role => [role, {
  id: randomUUID(), aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`,
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString(),
}]))
const tokens = new Map()
const refreshTokens = new Map()
let active = true
let renewals = 0
let managementFailure = null
let lastMutation = null
let appointmentsRpcMissing = false
function issue(user) {
  const payload = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated' }
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${randomUUID()}`
  const refresh = randomUUID()
  tokens.set(token, user); refreshTokens.set(refresh, user)
  return { access_token: token, refresh_token: refresh, token_type: 'bearer', expires_in: 3600, user }
}
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {}
  const url = new URL(req.url, 'http://localhost')
  const user = tokens.get(req.headers.authorization?.replace('Bearer ', ''))
  const privileged = req.headers.apikey === 'sb_secret_fixture'
  res.setHeader('content-type', 'application/json')
  function send(code, data) { res.statusCode = code; res.end(JSON.stringify(data)) }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      const refreshed = refreshTokens.get(body.refresh_token)
      if (!refreshed) return send(400, { code: 'refresh_token_not_found', message: 'Invalid token' })
      renewals++; return send(200, issue(refreshed))
    }
    const found = [...users.values()].find(u => u.email === body.email)
    return found && body.password === 'fixture-password' ? send(200, issue(found)) : send(400, { code: 'invalid_credentials', message: 'Invalid credentials' })
  }
  if (url.pathname === '/auth/v1/user') return user ? send(200, user) : send(401, { code: 'bad_jwt', message: 'Invalid token' })
  if (url.pathname === '/auth/v1/logout') {
    tokens.delete(req.headers.authorization?.replace('Bearer ', ''))
    for (const [key, value] of refreshTokens) if (value.id === user?.id) refreshTokens.delete(key)
    res.statusCode = 204; return res.end()
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (!user || user.email.startsWith('outsider')) return send(200, null)
    return send(200, { id: user.id, full_name: 'Fixture User', role: user.email.startsWith('admin') ? 'admin' : 'staff', is_active: active && !user.email.startsWith('inactive') })
  }
  if (url.pathname === '/rest/v1/rpc/get_booking_catalog') return send(200, {
    shop:{name:'Toli Hair',phone:null,address:null,timezone:'Europe/Belgrade',currency:'EUR',booking_enabled:true,minimum_notice_minutes:0,booking_horizon_days:60},
    services:[{id:'30000000-0000-4000-8000-000000000001',name:'Prerje klasike',description:'Prerje profesionale',duration_minutes:30,price_minor:2500},{id:'30000000-0000-4000-8000-000000000002',name:'Mjekër',description:'Rregullim profesional',duration_minutes:20,price_minor:1200}],
    barbers:[{id:'20000000-0000-4000-8000-000000000001',name:'Berberi testues',bio:'Pjesë e ekipit',service_ids:['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']}],
  })
  if (url.pathname === '/rest/v1/rpc/get_available_slots_multi') return send(200, [{slot_start:'2026-09-14T10:00:00Z',local_time:'10:00',barber_id:'20000000-0000-4000-8000-000000000001',barber_name:'Fixture Barber'}])
  if (url.pathname === '/rest/v1/rpc/get_available_slots') return send(200, [{slot_start:'2026-09-14T10:00:00Z',local_time:'10:00',barber_id:'20000000-0000-4000-8000-000000000001',barber_name:'Fixture Barber'}])
  if (url.pathname === '/rest/v1/rpc/create_guest_booking' && body.p_key === '10000000-0000-4000-8000-000000000002') return send(400,{code:'23P01',message:'private overlap detail'})
  if (url.pathname === '/rest/v1/rpc/create_guest_booking_multi') return send(200, {
    receipt_token:'40000000-0000-4000-8000-000000000003',appointment_id:'50000000-0000-4000-8000-000000000003',customer_name:body.p_name,
    service_name:'Prerje klasike + Mjekër',barber_id:body.p_barber,starts_at:body.p_start,ends_at:'2026-09-14T10:50:00Z',duration_minutes:50,price_minor:3700,currency:'EUR',status:'confirmed',
  })
  if (url.pathname === '/rest/v1/rpc/create_guest_booking') return send(200, {
    receipt_token:'40000000-0000-4000-8000-000000000001',appointment_id:'50000000-0000-4000-8000-000000000001',customer_name:body.p_name,
    service_name:'Fixture Service',barber_id:body.p_barber,starts_at:body.p_start,ends_at:'2026-09-14T10:30:00Z',duration_minutes:30,price_minor:2500,currency:'EUR',status:'confirmed',
  })
  if (url.pathname === '/rest/v1/rpc/get_guest_booking_receipt' && body.p_token === '40000000-0000-4000-8000-000000000002') return send(200,null)
  if (url.pathname === '/rest/v1/rpc/get_guest_booking_receipt') return send(200, {
    receipt_token:body.p_token,appointment_id:'50000000-0000-4000-8000-000000000001',customer_name:'Fixture Customer',service_name:'Fixture Service',
    barber_id:'20000000-0000-4000-8000-000000000001',barber_name:'Fixture Barber',starts_at:'2026-09-14T10:00:00Z',ends_at:'2026-09-14T10:30:00Z',duration_minutes:30,price_minor:2500,currency:'EUR',status:'confirmed',
  })
  const staffAppointment = {
    id:'50000000-0000-4000-8000-000000000002',barber_id:'20000000-0000-4000-8000-000000000001',service_id:'30000000-0000-4000-8000-000000000001',
    customer_name:'Klienti Testues',customer_phone:'+383 44 123 456',customer_email:null,service_name:'Prerje klasike',duration_minutes:30,
    starts_at:'2026-09-14T10:00:00Z',ends_at:'2026-09-14T10:30:00Z',price_minor:2500,currency:'EUR',status:'confirmed',source:'staff',
    created_by:user?.id ?? null,version:1,created_at:'2026-09-12T08:00:00Z',updated_at:'2026-09-12T08:00:00Z',barber_name:'Berberi testues',
  }
  if (url.pathname === '/rest/v1/rpc/get_staff_appointments' && user) {
    if (appointmentsRpcMissing) return send(404, { code: 'PGRST202', message: 'Function missing from schema cache' })
    return send(200,[staffAppointment])
  }
  if (url.pathname === '/rest/v1/appointments' && user) return send(200,[staffAppointment])
  if (url.pathname === '/rest/v1/rpc/get_staff_available_slots' && user) return send(200,[{slot_start:'2026-09-14T10:00:00Z',local_time:'10:00',barber_id:staffAppointment.barber_id,barber_name:'Berberi testues'}])
  if (['create_staff_appointment','update_staff_appointment','set_appointment_status'].some(name => url.pathname === `/rest/v1/rpc/${name}`) && user) {
    lastMutation = { path: url.pathname, body }
    return send(200,{...staffAppointment,customer_name:body.p_name ?? staffAppointment.customer_name,status:body.p_status ?? staffAppointment.status})
  }
  if (url.pathname === '/rest/v1/rpc/set_online_booking' && user) return send(200,{success:true})
  if (url.pathname === '/rest/v1/rpc/manage_shop' && user) {
    lastMutation = body
    return managementFailure ? send(400, managementFailure) : send(200, { success: true })
  }
  if (['services', 'barbers', 'barber_services', 'working_hours', 'blocked_times', 'shop_settings'].some(table => url.pathname === `/rest/v1/${table}`) && (user || privileged)) {
    if (privileged && req.method === 'GET' && url.pathname.endsWith('/services')) return send(200, [{ id: '30000000-0000-4000-8000-000000000001' }])
    if (privileged && req.method === 'GET' && url.pathname.endsWith('/barbers')) return send(200, [{ id: '20000000-0000-4000-8000-000000000001' }])
    return send(200, url.pathname.endsWith('/shop_settings') ? { revision: 1, name: 'Fixture shop', currency: 'EUR', timezone: 'UTC' } : [])
  }
  send(404, {})
})
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve))
const providerAddress = provider.address()
if (!providerAddress || typeof providerAddress === 'string') throw new Error('Porti i Supabase testues nuk u përcaktua.')
const providerOrigin = `http://127.0.0.1:${providerAddress.port}`
const origin = 'http://127.0.0.1:3102'
const app = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: '3102', NUXT_APP_ORIGIN: origin,
    NUXT_PUBLIC_SUPABASE_URL: providerOrigin, NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', NUXT_SUPABASE_SECRET_KEY: 'sb_secret_fixture' },
  stdio: 'ignore',
})
let checks = 0
function jar() { return new Map() }
async function request(path, { cookies, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method, redirect: 'manual', headers: {
      ...(cookies ? { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') } : {}),
      ...(body !== undefined ? { origin, 'x-toli-request': '1', 'content-type': 'application/json' } : {}), ...headers,
    }, body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (cookies) for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(';'); const index = pair.indexOf('=')
    if (/max-age=0/i.test(line)) cookies.delete(pair.slice(0,index))
    else cookies.set(pair.slice(0,index),pair.slice(index+1))
  }
  return response
}
async function expect(path, status, options) {
  const response = await request(path, options)
  assert.equal(response.status, status, `${path}: ${await response.clone().text()}`)
  checks++; return response
}
const credentials = role => ({ email: `${role}@example.test`, password: 'fixture-password' })
try {
  let ready = false
  for (let i=0;i<60;i++) {
    try { if ((await fetch(origin+'/login')).ok) { ready=true; break } } catch { /* Await startup. */ }
    await delay(250)
  }
  assert.ok(ready, 'Production app started')
  const health = await expect('/api/health',200)
  assert.deepEqual(await health.json(),{status:'ok'})
  assert.equal(health.headers.get('x-content-type-options'),'nosniff')
  assert.equal(health.headers.get('x-frame-options'),'DENY')
  assert.match(health.headers.get('permissions-policy'),/camera=\(\)/)
  assert.match(health.headers.get('cache-control'),/no-store/)
  const homePage = await expect('/',200)
  const homeHtml = await homePage.text()
  assert.match(homeHtml,/Stili yt/)
  assert.match(homeHtml,/Prerje klasike/)
  const bookingPage = await expect('/booking',200)
  assert.match(await bookingPage.text(),/Zgjidh berberin/)
  await expect('/dashboard',302)
  await expect('/dashboard/appointments',302)
  await expect('/api/dashboard/session',401)
  await expect('/api/dashboard/settings',401)
  await expect('/api/dashboard/appointments?from=2026-09-12&to=2026-09-15',401)
  await expect('/api/%64ashboard/settings',401)
  const catalog = await expect('/api/booking/catalog',200)
  assert.equal((await catalog.json()).shop.booking_enabled,true)
  await expect('/api/booking/availability',422)
  const availability = await expect('/api/booking/availability?serviceId=30000000-0000-4000-8000-000000000001&barberId=20000000-0000-4000-8000-000000000001&date=2026-09-14',200)
  assert.equal((await availability.json()).slots.length,1)
  const multiAvailability = await expect('/api/booking/availability?serviceIds=30000000-0000-4000-8000-000000000001,30000000-0000-4000-8000-000000000002&barberId=20000000-0000-4000-8000-000000000001&date=2026-09-14',200)
  assert.equal((await multiAvailability.json()).slots.length,1)
  const bookingBody = {idempotencyKey:'10000000-0000-4000-8000-000000000001',serviceId:'30000000-0000-4000-8000-000000000001',barberId:'20000000-0000-4000-8000-000000000001',startsAt:'2026-09-14T10:00:00Z',customer:{fullName:'Fixture Customer',phone:'+36 201234567',email:'test@example.com'}}
  await expect('/api/booking',403,{method:'POST',body:bookingBody,headers:{origin:'https://evil.example'}})
  await expect('/api/booking',422,{method:'POST',body:{}})
  const booked = await expect('/api/booking',200,{method:'POST',body:bookingBody})
  const bookedJson = await booked.json()
  assert.equal(bookedJson.receipt.customerName,'Fixture Customer')
  assert.ok(!JSON.stringify(bookedJson).includes('customer_phone'))
  const multiBooked = await expect('/api/booking',200,{method:'POST',body:{...bookingBody,idempotencyKey:'10000000-0000-4000-8000-000000000004',serviceId:undefined,serviceIds:['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002']}})
  assert.equal((await multiBooked.json()).receipt.durationMinutes,50)
  const occupied = await expect('/api/booking',409,{method:'POST',body:{...bookingBody,idempotencyKey:'10000000-0000-4000-8000-000000000002'}})
  assert.ok(!(await occupied.text()).includes('private overlap detail'))
  const receipt = await expect('/api/booking/receipt',200,{method:'POST',body:{token:bookedJson.receipt.token}})
  assert.equal((await receipt.json()).receipt.barberName,'Fixture Barber')
  await expect('/api/booking/receipt',404,{method:'POST',body:{token:'40000000-0000-4000-8000-000000000002'}})
  const empty = await expect('/api/auth/me',200)
  assert.equal((await empty.json()).staff,null)
  await expect('/api/auth/login',403,{method:'POST',body:credentials('admin'),headers:{origin:'https://evil.example'}})
  await expect('/api/auth/logout',403,{method:'POST',body:{},headers:{'x-toli-request':''}})
  await expect('/api/auth/login',422,{method:'POST',body:{email:'bad'}})
  await expect('/api/auth/login',413,{method:'POST',body:{email:'admin@example.test',password:'x'.repeat(5000)}})
  await expect('/api/auth/login',401,{method:'POST',body:{...credentials('admin'),password:'wrong'}})
  for (const role of ['inactive','outsider']) {
    const cookies = jar()
    await expect('/api/auth/login',401,{method:'POST',body:credentials(role),cookies})
    await expect('/api/dashboard/session',401,{cookies})
  }
  const admin = jar()
  const loggedIn = await expect('/api/auth/login',200,{method:'POST',body:credentials('admin'),cookies:admin})
  const json = await loggedIn.json()
  assert.equal(json.staff.role,'admin')
  assert.ok(!JSON.stringify(json).includes('access_token'))
  for (const cookie of loggedIn.headers.getSetCookie()) {
    assert.match(cookie,/HttpOnly/i); assert.match(cookie,/Secure/i); assert.match(cookie,/SameSite=Lax/i)
  }
  await expect('/dashboard',200,{cookies:admin})
  await expect('/dashboard/settings',200,{cookies:admin})
  const appointments = await expect('/api/dashboard/appointments?from=2026-09-12&to=2026-09-15',200,{cookies:admin})
  assert.equal((await appointments.json()).appointments[0].customer_name,'Klienti Testues')
  appointmentsRpcMissing = true
  const fallbackAppointments = await expect('/api/dashboard/appointments?from=2026-09-12&to=2026-09-15',200,{cookies:admin})
  assert.equal((await fallbackAppointments.json()).appointments[0].customer_name,'Klienti Testues')
  appointmentsRpcMissing = false
  await expect('/api/dashboard/appointments?from=bad&to=2026-09-15',422,{cookies:admin})
  const staffSlots = await expect('/api/dashboard/availability?serviceId=30000000-0000-4000-8000-000000000001&barberId=20000000-0000-4000-8000-000000000001&date=2026-09-14',200,{cookies:admin})
  assert.equal((await staffSlots.json()).slots[0].localTime,'10:00')
  const staffCreate = {action:'create',idempotencyKey:'10000000-0000-4000-8000-000000000003',serviceId:'30000000-0000-4000-8000-000000000001',barberId:'20000000-0000-4000-8000-000000000001',startsAt:'2026-09-14T10:00:00Z',customer:{fullName:'Klienti Testues',phone:'+383 44 123 456',email:''}}
  await expect('/api/dashboard/appointments',403,{cookies:admin,method:'POST',body:staffCreate,headers:{origin:'https://evil.example'}})
  await expect('/api/dashboard/appointments',422,{cookies:admin,method:'POST',body:{}})
  const staffCreated = await expect('/api/dashboard/appointments',200,{cookies:admin,method:'POST',body:staffCreate})
  assert.equal((await staffCreated.json()).appointment.customer_name,'Klienti Testues')
  assert.equal(lastMutation.path,'/rest/v1/rpc/create_staff_appointment')
  await expect('/api/dashboard/appointments',200,{cookies:admin,method:'POST',body:{action:'status',id:'50000000-0000-4000-8000-000000000002',version:1,status:'cancelled'}})
  assert.equal(lastMutation.path,'/rest/v1/rpc/set_appointment_status')
  await expect('/api/dashboard/booking-status',200,{cookies:admin,method:'POST',body:{enabled:true,revision:1}})
  for (const resource of ['services','barbers','working-hours','blocked-times','settings']) {
    const loaded = await expect(`/api/dashboard/${resource}`,200,{cookies:admin})
    assert.deepEqual((await loaded.json()).services, [])
    await expect(`/api/dashboard/${resource}`,422,{cookies:admin,method:'POST',body:{}})
    await expect(`/api/dashboard/${resource}`,403,{cookies:admin,method:'POST',body:{},headers:{origin:'https://evil.example'}})
  }
  const serviceBody = { name:'Haircut', description:'', duration_minutes:30, price_minor:2000, is_active:true }
  await expect('/api/dashboard/services',200,{cookies:admin,method:'POST',body:serviceBody})
  assert.deepEqual(lastMutation,{p_resource:'services',p_data:serviceBody})
  await expect('/api/dashboard/services',422,{cookies:admin,method:'POST',body:{...serviceBody,role:'admin'}})
  await expect('/api/dashboard/services',413,{cookies:admin,method:'POST',body:{...serviceBody,description:'x'.repeat(34000)}})
  managementFailure = {code:'40001',message:'stale revision'}
  await expect('/api/dashboard/services',409,{cookies:admin,method:'POST',body:serviceBody})
  managementFailure = {code:'XX000',message:'private database detail'}
  const failedSave = await expect('/api/dashboard/services',503,{cookies:admin,method:'POST',body:serviceBody})
  assert.ok(!(await failedSave.text()).includes('private database detail'))
  managementFailure = null
  const session = await expect('/api/dashboard/session',200,{cookies:admin})
  assert.match(session.headers.get('cache-control'),/no-store/)
  // Force session expiry in the fixture cookie to exercise refresh rotation.
  const [cookieName, cookieValue] = [...admin][0]
  const decoded = JSON.parse(Buffer.from(decodeURIComponent(cookieValue).slice('base64-'.length),'base64url').toString())
  decoded.expires_at = Math.floor(Date.now()/1000)-60
  admin.set(cookieName,'base64-'+Buffer.from(JSON.stringify(decoded)).toString('base64url'))
  await expect('/api/auth/me',200,{cookies:admin})
  assert.ok(renewals > 0,'Expired session refreshed')
  active = false
  await expect('/api/dashboard/session',401,{cookies:admin})
  active = true
  const staff = jar()
  await expect('/api/auth/login',200,{method:'POST',body:credentials('staff'),cookies:staff})
  await expect('/dashboard/appointments',200,{cookies:staff})
  await expect('/dashboard/settings',403,{cookies:staff,headers:{accept:'text/html'}})
  await expect('/api/dashboard/settings',403,{cookies:staff})
  await expect('/api/dashboard/booking-status',403,{cookies:staff,method:'POST',body:{enabled:true,revision:1}})
  for (const resource of ['services','barbers','working-hours','blocked-times','settings']) {
    await expect(`/api/dashboard/${resource}`,403,{cookies:staff,method:'POST',body:{}})
  }
  await expect('/api/dashboard/%73ettings',403,{cookies:staff})
  await expect('/api/auth/logout',200,{method:'POST',body:{},cookies:admin})
  await expect('/api/dashboard/session',401,{cookies:admin})
  // The IP budget eventually rejects requests before calling Supabase.
  let limited = false
  for(let i=0;i<12;i++) {
    const response=await request('/api/auth/login',{method:'POST',body:{email:'bad'}})
    if(response.status===429){assert.ok(response.headers.get('retry-after'));limited=true;break}
  }
  assert.ok(limited); checks++
  console.log(`${checks} auth HTTP checks passed, including cookies, refresh, CSRF, roles, inactive users, and logout.`)
}
finally { app.kill(); await new Promise(resolve => provider.close(resolve)) }
