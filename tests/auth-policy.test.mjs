import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDashboardPath, requiresAdmin, safeDashboardRedirect } from '../shared/utils/auth-policy.ts'

test('dashboard boundary and administrator sections', () => {
  assert.equal(isDashboardPath('/dashboard'),true)
  assert.equal(isDashboardPath('/api/dashboard/session'),true)
  assert.equal(isDashboardPath('/api/%64ashboard/session'),true)
  assert.equal(requiresAdmin('/dashboard/%73ettings'),true)
  assert.equal(isDashboardPath('/dashboard-other'),false)
  for(const path of ['services','barbers','working-hours','blocked-times','settings']) assert.equal(requiresAdmin('/api/dashboard/'+path),true)
  assert.equal(requiresAdmin('/dashboard/appointments'),false)
  assert.equal(requiresAdmin('/api/dashboard/booking-status'),true)
})
test('login redirect cannot navigate off-site', () => {
  for(const value of ['https://evil.example','//evil.example','/dashboard/../login','/dashboard/%2f%2fevil.example','/dashboard\\evil.example',undefined]) {
    const output=safeDashboardRedirect(value)
    assert.equal(output,'/dashboard')
  }
  assert.equal(safeDashboardRedirect('/dashboard/calendar'),'/dashboard/calendar')
})
