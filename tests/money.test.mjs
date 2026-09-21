import test from 'node:test'
import assert from 'node:assert/strict'
import { priceToMinor } from '../shared/utils/money.ts'

test('çmimi pranon vlera tekst dhe numër nga input-i HTML', () => {
  assert.equal(priceToMinor('12.50',2),1250)
  assert.equal(priceToMinor(12.5,2),1250)
  assert.equal(priceToMinor(0,2),0)
})

test('çmimi refuzon vlera të zbrazëta, negative dhe precizion të tepërt', () => {
  assert.equal(priceToMinor('',2),null)
  assert.equal(priceToMinor(-1,2),null)
  assert.equal(priceToMinor('12.345',2),null)
  assert.equal(priceToMinor('paçmim',2),null)
})
