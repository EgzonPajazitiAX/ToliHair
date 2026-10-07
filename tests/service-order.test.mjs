import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { z } from 'zod'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const source = stripTypeScriptTypes(readFileSync(new URL('../shared/utils/service-order.ts', import.meta.url), 'utf8')).replaceAll('export function', 'function')
const { moveService } = runInNewContext(`${source}\n({ moveService })`)
test('move forward or backward without changing other relative positions', () => {
  const ids = ['a', 'b', 'c', 'd']
  assert.deepEqual([...moveService(ids, 'a', 'c')], ['b', 'c', 'a', 'd'])
  assert.deepEqual([...moveService(ids, 'd', 'a')], ['d', 'a', 'b', 'c'])
  assert.deepEqual(ids, ['a', 'b', 'c', 'd'])
  assert.deepEqual([...moveService(ids, 'b', 'b')], ids)
  assert.deepEqual([...moveService(ids, 'unknown', 'a')], ids)
})
const schemaSource = stripTypeScriptTypes(readFileSync(new URL('../shared/schemas/management.ts', import.meta.url), 'utf8')).replace(/import[^\n]+\n/g, '').replaceAll('export const', 'const')
const schema = runInNewContext(`${schemaSource}\nmanagementSchemas.services`, { z })
const service = { id: '10000000-0000-4000-8000-000000000001', revision: 1 }
test('reorder accepts only a unique list of versioned service IDs', () => {
  assert.equal(schema.safeParse({ action: 'reorder', services: [service] }).success, true)
  for (const services of [[], [service, service], [{ ...service, revision: 0 }], [{ ...service, id: 'invalid' }]]) {
    assert.equal(schema.safeParse({ action: 'reorder', services }).success, false)
  }
  assert.equal(schema.safeParse({ action: 'reorder', services: [service], price_minor: 0 }).success, false)
})
const repoSource = stripTypeScriptTypes(readFileSync(new URL('../server/repositories/management.ts', import.meta.url), 'utf8')).replace(/import[^\n]+\n/g, '').replaceAll('export async function', 'async function')
const { saveManagement } = runInNewContext(`${repoSource}\n({ saveManagement })`, { managementError: error => { throw error } })
test('reorder uses one atomic RPC and propagates conflicts', async () => {
  const calls = []
  await saveManagement({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null } } }, 'services', { action: 'reorder', services: [service] })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'reorder_services')
  assert.equal(calls[0].args.p_order[0].revision, 1)
  await assert.rejects(saveManagement({ rpc: async () => ({ error: new Error('Stale') }) }, 'services', { action: 'reorder', services: [service] }), /Stale/)
})
const component = readFileSync(new URL('../app/components/dashboard/Management.vue', import.meta.url), 'utf8')
test('management component script and template compile without parser errors', () => {
  const { descriptor, errors } = parse(component)
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'management-test' })
  const result = compileTemplate({ source: descriptor.template.content, filename: 'Management.vue', id: 'management-test', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(result.errors, [])
})
function dragEditor() {
  const state = { serviceDrag: { value: null }, serviceOrder: { value: ['a', 'b', 'c'] }, saving: { value: false }, open: { value: false } }
  const moves = []
  const hit = { current: 'b' }
  const servicePreviewOrder = { get value() { const drag = state.serviceDrag.value; return drag?.moved && drag.target ? moveService(state.serviceOrder.value, drag.id, drag.target) : state.serviceOrder.value } }
  const document = { elementFromPoint: () => hit.current ? { closest: () => ({ dataset: { serviceId: hit.current }, closest: () => true }) } : null }
  const source = stripTypeScriptTypes(component.slice(component.indexOf('function startServiceDrag('), component.indexOf("const selectedBarber =")))
  const functions = runInNewContext(`${source}\n({startServiceDrag, updateServiceDrag, finishServiceDrag, cancelServiceDrag, serviceOrderKey})`, { ...state, servicePreviewOrder, document, persistServiceOrder: (a, b) => moves.push([a, b]) })
  const sorter = { setPointerCapture() {} }
  const event = { isPrimary: true, button: 0, pointerId: 1, clientX: 20, clientY: 20, preventDefault() {}, target: { closest: () => null }, currentTarget: { closest: () => sorter, focus() {}, parentElement: null } }
  return { ...state, ...functions, servicePreviewOrder, moves, hit, event }
}
test('drag saves only on release over a valid service; taps and cancellation do not save', () => {
  const state = dragEditor()
  state.startServiceDrag(state.event, 'a')
  state.finishServiceDrag(state.event)
  assert.equal(state.moves.length, 0)
  state.startServiceDrag(state.event, 'a')
  state.updateServiceDrag({ ...state.event, clientY: 80 })
  assert.equal(state.moves.length, 0)
  assert.deepEqual([...state.servicePreviewOrder.value], ['b', 'a', 'c'])
  state.finishServiceDrag({ ...state.event, clientY: 80 })
  assert.deepEqual(state.moves, [['a', 'b']])
  state.startServiceDrag(state.event, 'a')
  state.cancelServiceDrag()
  state.finishServiceDrag({ ...state.event, clientY: 80 })
  assert.equal(state.moves.length, 1)
})
test('live preview remains stable when the moved source fills the hovered slot', () => {
  const state = dragEditor()
  state.startServiceDrag(state.event, 'a')
  state.updateServiceDrag({ ...state.event, clientY: 80 })
  state.hit.current = 'a'
  state.updateServiceDrag({ ...state.event, clientY: 81 })
  assert.deepEqual([...state.servicePreviewOrder.value], ['b', 'a', 'c'])
  state.cancelServiceDrag()
  assert.deepEqual([...state.servicePreviewOrder.value], ['a', 'b', 'c'])
  assert.equal(state.moves.length, 0)
})
test('interactive controls inside a card are never captured for dragging', () => {
  const state = dragEditor()
  state.startServiceDrag({ ...state.event, target: { closest: () => ({}) } }, 'a')
  assert.equal(state.serviceDrag.value, null)
})
test('drop outside the list or while saving cannot reorder; keyboard arrows do', () => {
  const state = dragEditor()
  state.startServiceDrag(state.event, 'a')
  state.hit.current = null
  state.finishServiceDrag({ ...state.event, clientY: 80 })
  assert.equal(state.moves.length, 0)
  state.saving.value = true
  state.startServiceDrag(state.event, 'a')
  assert.equal(state.serviceDrag.value, null)
  state.saving.value = false
  state.serviceOrderKey({ key: 'ArrowDown', preventDefault() {} }, 'a')
  assert.deepEqual(state.moves, [['a', 'b']])
})
