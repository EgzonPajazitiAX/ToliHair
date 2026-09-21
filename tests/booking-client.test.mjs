import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { computed, effectScope, onScopeDispose, reactive, ref, watch } from 'vue'

const source = stripTypeScriptTypes(readFileSync(new URL('../app/composables/useBooking.ts', import.meta.url), 'utf8'))
  .replace('export function useBooking', 'function useBooking')
const idempotencySource = stripTypeScriptTypes(readFileSync(new URL('../app/utils/idempotency.ts', import.meta.url), 'utf8'))
  .replace('export function createIdempotencyKey', 'function createIdempotencyKey')

function setup(fetcher, cryptoApi = { randomUUID }) {
  const scope = effectScope()
  const receipt = ref(null)
  const navigations = []
  const catalog = ref({
    shop: { timezone: 'Europe/Belgrade', booking_horizon_days: 60 },
    services: [{ id: 'service', name: 'Prerje', duration_minutes: 30, price_minor: 500 }],
    barbers: [{ id: 'barber', service_ids: ['service'] }],
  })
  const context = {
    computed, onScopeDispose, reactive, ref, watch,
    useFetch: () => ({ data: catalog }),
    useState: () => receipt,
    $fetch: fetcher,
    crypto: cryptoApi,
    sessionStorage: { setItem() { throw new Error('Storage blocked') } },
    navigateTo: async path => { navigations.push(path) },
  }
  const booking = scope.run(() => runInNewContext(`${idempotencySource}\n${source}\nuseBooking()`, context))
  booking.chooseBarber('barber')
  booking.toggleService('service')
  booking.date.value = '2026-09-15'
  return { booking, scope, receipt, navigations }
}

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
