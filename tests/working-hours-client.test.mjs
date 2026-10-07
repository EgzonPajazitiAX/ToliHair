import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const component = readFileSync(new URL('../app/components/dashboard/Management.vue', import.meta.url), 'utf8')
const validation = component.slice(component.indexOf('const minutes ='), component.indexOf('const hoursInvalid ='))
const selection = component.slice(component.indexOf('function dayIntervals('), component.indexOf('async function submitHours('))
function editor(rows = []) {
  return runInNewContext(stripTypeScriptTypes(`const intervals = { value: ${JSON.stringify(rows)} }; ${validation}\n${selection}\n({ intervals, dayError, nextShift, addShift, toggleDay, removeShift })`))
}
const row = (start, end, weekday = 1) => ({ weekday, start_time: start, end_time: end })

test('valid split days and midnight endings are allowed', () => {
  assert.equal(editor([row('09:00', '13:00'), row('14:00', '24:00')]).dayError(1), '')
  assert.equal(editor([row('09:00', '13:00'), row('13:00', '17:00')]).dayError(1), '')
})
test('reject malformed times, inverted intervals and overlaps regardless of order', () => {
  for (const rows of [[row('24:00', '24:00')], [row('09:00', '08:00')], [row('09:00', '')], [row('9:00', '17:00')], [row('14:00', '18:00'), row('09:00', '15:00')]]) {
    assert.notEqual(editor(rows).dayError(1), '')
  }
})
test('adding an interval preserves existing hours and leaves a pause', () => {
  const state = editor([row('09:00', '20:00')])
  state.addShift(1)
  assert.equal(state.intervals.value[0].end_time, '20:00')
  assert.equal(state.intervals.value[1].start_time, '20:30')
  assert.equal(state.intervals.value[1].end_time, '21:30')
  assert.equal(state.dayError(1), '')
})
test('find a free gap and refuse additions without space or above the limit', () => {
  const state = editor([row('09:00', '12:00'), row('15:00', '24:00')])
  state.addShift(1)
  assert.equal(state.intervals.value[2].start_time, '12:30')
  assert.equal(state.dayError(1), '')
  assert.equal(editor([row('09:00', '24:00')]).nextShift(1), null)
  assert.equal(editor(Array.from({ length: 28 }, () => row('09:00', '10:00', 2))).nextShift(1), null)
})
test('closing a day leaves other days untouched; removing last interval closes it', () => {
  const state = editor([row('09:00', '17:00'), row('10:00', '18:00', 2)])
  state.toggleDay(1, false)
  assert.equal(state.intervals.value.length, 1)
  assert.equal(state.intervals.value[0].weekday, 2)
  state.removeShift(state.intervals.value[0])
  assert.equal(state.intervals.value.length, 0)
})
