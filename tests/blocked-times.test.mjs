import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { z } from 'zod'

const schemaSource = stripTypeScriptTypes(readFileSync(new URL('../shared/schemas/management.ts', import.meta.url), 'utf8')).replace(/import[^\n]+\n/g, '').replaceAll('export const', 'const')
const schema = runInNewContext(`${schemaSource}\nmanagementSchemas['blocked-times']`, { z })
const body = { all_barbers: true, start_local: '2027-01-01T00:00', end_local: '2027-01-02T00:00', reason: 'Festë' }
test('all-barber closure accepts a whole day but cannot be used to edit a record', () => {
  assert.equal(schema.safeParse(body).success, true)
  assert.equal(schema.safeParse({ ...body, id: '10000000-0000-4000-8000-000000000001', revision: 1 }).success, false)
  assert.equal(schema.safeParse({ ...body, all_barbers: false }).success, false)
  assert.equal(schema.safeParse({ ...body, end_local: body.start_local }).success, false)
  assert.equal(schema.safeParse({ ...body, reason: 'x'.repeat(501) }).success, false)
})
const repoSource = stripTypeScriptTypes(readFileSync(new URL('../server/repositories/management.ts', import.meta.url), 'utf8')).replace(/import[^\n]+\n/g, '').replaceAll('export async function', 'async function')
const { saveManagement } = runInNewContext(`${repoSource}\n({ saveManagement })`, { managementError: error => { throw error } })
test('all barbers uses one atomic RPC, never a client-side loop', async () => {
  const calls = []
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { error: null } } }
  await saveManagement(client, 'blocked-times', body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'block_all_barbers')
  assert.equal(calls[0].args.p_start_local, body.start_local)
  await saveManagement(client, 'blocked-times', { id: 'record', revision: 1, action: 'delete' })
  assert.equal(calls[1].name, 'manage_shop')
})
test('a rejected closure is not reported as saved', async () => {
  await assert.rejects(saveManagement({ rpc: async () => ({ error: new Error('Conflict') }) }, 'blocked-times', body), /Conflict/)
})
