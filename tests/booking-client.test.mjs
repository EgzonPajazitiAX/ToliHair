import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { computed, effectScope, onScopeDispose, reactive, ref, watch } from 'vue'

const source = stripTypeScriptTypes(readFileSync(new URL('../app/composables/useBooking.ts', import.meta.url), 'utf8'))
  .replace(/import \{ adjustedPrice, multiplierAtTime \} from '[^']+'/, '')
  .replace('export function useBooking', 'function useBooking')
const pricingSource = stripTypeScriptTypes(readFileSync(new URL('../shared/utils/pricing.ts', import.meta.url), 'utf8')).replaceAll('export function', 'function')
const idempotencySource = stripTypeScriptTypes(readFileSync(new URL('../app/utils/idempotency.ts', import.meta.url), 'utf8'))
  .replace('export function createIdempotencyKey', 'function createIdempotencyKey')

function setup(fetcher, cryptoApi = { randomUUID }) {
  const scope = effectScope()
  const receipt = ref(null)
  const navigations = []
  const catalog = ref({
    shop: { timezone: 'Europe/Belgrade', booking_horizon_days: 60, peak_pricing_enabled: true, peak_start_time: '17:00', peak_end_time: '20:00', peak_multiplier: 1.5 },
    services: [{ id: 'service', name: 'Prerje', duration_minutes: 30, price_minor: 500 }],
    barbers: [{ id: 'barber', service_ids: ['service'] }],
  })
  const context = {
    computed, onScopeDispose, reactive, ref, watch,
    useFetch: () => ({ data: catalog, refresh: async () => {} }),
    useState: () => receipt,
    $fetch: fetcher,
    crypto: cryptoApi,
    sessionStorage: { setItem() { throw new Error('Storage blocked') } },
    navigateTo: async path => { navigations.push(path) },
  }
  const booking = scope.run(() => runInNewContext(`${pricingSource}\n${idempotencySource}\n${source}\nuseBooking()`, context))
  booking.chooseBarber('barber')
  booking.toggleService('service')
  booking.date.value = '2026-09-15'
  return { booking, scope, receipt, navigations, catalog }
}

test('the flow chooses time before services and checks the complete duration before details', async () => {
  const calls = []
  const { booking, scope } = setup(async (url, options) => {
    calls.push({ url, options })
    return { slots: [{ startsAt: '2026-09-15T15:00:00Z', localTime: '17:00', barberId: 'barber', serviceIds: ['service'] }] }
  })
  try {
    assert.equal(booking.step.value,2)
    await booking.loadSlots()
    assert.equal(calls[0].url,'/api/booking/start-times')
    booking.slot.value = booking.slots.value[0]
    booking.step.value = 3
    await booking.continueFromServices()
    assert.equal(calls[1].url,'/api/booking/availability')
    assert.equal(booking.step.value,4)
    assert.equal(booking.totalPrice.value,750)
  }
  finally { scope.stop() }
})

test('services that do not fit the chosen time are not offered', () => {
  const { booking, scope } = setup(async () => ({ slots: [] }))
  try {
    booking.slot.value = { startsAt: '2026-09-15T15:00:00Z', localTime: '17:00', serviceIds: [] }
    assert.equal(booking.availableServices.value.length,0)
  }
  finally { scope.stop() }
})

test('an unavailable service combination does not continue to customer details', async () => {
  const { booking, scope } = setup(async () => ({ slots: [] }))
  try {
    booking.slot.value = { startsAt: '2026-09-15T15:00:00Z', localTime: '17:00', barberId: 'barber' }
    booking.step.value = 3
    await booking.continueFromServices()
    assert.equal(booking.step.value,3)
    assert.match(booking.message.value,/nuk mjafton/)
  }
  finally { scope.stop() }
})

test('a changed quote returns to services for review without booking automatically', async () => {
  let quotedPrice
  const { booking, scope, navigations } = setup(async (_url, options) => {
    quotedPrice = options.body.expectedPriceMinor
    throw { statusCode: 409, data: { statusMessage: 'Çmimi ka ndryshuar.', data: { reason: 'price_changed' } } }
  })
  try {
    booking.slot.value = { startsAt: '2026-09-15T15:00:00Z', localTime: '17:00', barberId: 'barber' }
    booking.step.value = 5
    await booking.confirm()
    assert.equal(quotedPrice, 750)
    assert.equal(booking.step.value, 3)
    assert.equal(booking.slot.value.localTime, '17:00')
    assert.equal(booking.message.value, 'Çmimi ka ndryshuar.')
    assert.equal(booking.submitting.value, false)
    assert.deepEqual(navigations, [])
  }
  finally { scope.stop() }
})

test('a late availability response cannot replace the newly selected date', async () => {
  const requests = []
  const { booking, scope } = setup(() => new Promise(resolve => requests.push(resolve)))
  try {
    const first = booking.loadSlots()
    booking.date.value = '2026-09-16'
    const second = booking.loadSlots()
    requests[1]({ slots: [{ startsAt: '2026-09-16T08:00:00Z' }] })
    await second
    requests[0]({ slots: [{ startsAt: '2026-09-15T08:00:00Z' }] })
    await first
    assert.equal(booking.slots.value[0].startsAt, '2026-09-16T08:00:00Z')
    assert.equal(booking.loadingSlots.value, false)
  }
  finally { scope.stop() }
})

test('a stale failure does not clear the current loading state or show an error', async () => {
  const requests = []
  const { booking, scope } = setup(() => new Promise((resolve, reject) => requests.push({ resolve, reject })))
  try {
    const first = booking.loadSlots()
    booking.date.value = '2026-09-16'
    const second = booking.loadSlots()
    requests[0].reject(new Error('Old request failed'))
    await first
    assert.equal(booking.message.value, '')
    assert.equal(booking.loadingSlots.value, true)
    requests[1].resolve({ slots: [] })
    await second
    assert.equal(booking.loadingSlots.value, false)
  }
  finally { scope.stop() }
})

test('successful booking still navigates to confirmation when storage is blocked', async () => {
  const { booking, scope, receipt, navigations } = setup(async () => ({ receipt: { token: 'receipt-token' } }))
  try {
    booking.slot.value = { startsAt: '2026-09-15T08:00:00Z' }
    await booking.confirm()
    assert.equal(receipt.value.token, 'receipt-token')
    assert.deepEqual(navigations, ['/booking/success'])
    assert.equal(booking.message.value, '')
    assert.equal(booking.submitting.value, false)
  }
  finally { scope.stop() }
})

test('network retries reuse the booking key but selecting another time resets it', async () => {
  const keys = []
  const { booking, scope } = setup(async (_url, options) => {
    keys.push(options.body.idempotencyKey)
    throw new Error('Network unavailable')
  })
  try {
    booking.slot.value = { startsAt: '2026-09-15T08:00:00Z' }
    await booking.confirm()
    await booking.confirm()
    assert.equal(keys[0], keys[1])
    booking.slot.value = { startsAt: '2026-09-15T09:00:00Z' }
    await booking.confirm()
    assert.notEqual(keys[1], keys[2])
  }
  finally { scope.stop() }
})

test('booking creates a valid UUID when randomUUID is unavailable on an HTTP LAN origin', async () => {
  let key = ''
  let nextByte = 0
  const cryptoApi = { getRandomValues(bytes) { for (let index = 0; index < bytes.length; index++) bytes[index] = nextByte++; return bytes } }
  const { booking, scope } = setup(async (_url, options) => {
    key = options.body.idempotencyKey
    return { receipt: { token: 'receipt-token' } }
  }, cryptoApi)
  try {
    booking.slot.value = { startsAt: '2026-09-15T08:00:00Z' }
    await booking.confirm()
    assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.equal(booking.submitting.value, false)
  }
  finally { scope.stop() }
})
