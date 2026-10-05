import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const source = stripTypeScriptTypes(readFileSync(new URL('../shared/utils/pricing.ts', import.meta.url), 'utf8')).replaceAll('export function', 'function')
const { adjustedPrice, multiplierAtTime } = runInNewContext(`${source}\n({ adjustedPrice, multiplierAtTime })`)
const settings = { peak_pricing_enabled: true, peak_start_time: '17:00:00', peak_end_time: '20:00:00', peak_multiplier: 1.5 }

test('premium window includes 17:00 but excludes 20:00', () => {
  assert.equal(multiplierAtTime(settings, '16:59'), 1)
  assert.equal(multiplierAtTime(settings, '17:00'), 1.5)
  assert.equal(multiplierAtTime(settings, '19:59'), 1.5)
  assert.equal(multiplierAtTime(settings, '20:00'), 1)
})
test('disabled pricing or no selected time uses the base price', () => {
  assert.equal(multiplierAtTime({ ...settings, peak_pricing_enabled: false }, '18:00'), 1)
  assert.equal(multiplierAtTime(settings, ''), 1)
  assert.equal(multiplierAtTime(undefined, '18:00'), 1)
})
test('round each service to cents, consistently with PostgreSQL numeric round', () => {
  assert.equal(adjustedPrice(1000, 1.5), 1500)
  assert.equal(adjustedPrice(501, 1.5), 752)
  assert.equal(adjustedPrice(50, 1.01), 51)
  assert.equal(adjustedPrice(0, 1.5), 0)
  assert.equal(adjustedPrice(2000, 1), 2000)
  assert.equal(adjustedPrice(501, 1.5) + adjustedPrice(501, 1.5), 1504)
})
