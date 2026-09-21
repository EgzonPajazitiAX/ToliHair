import type { StaffIdentity } from '../../shared/types/auth'

export function useAuth() {
  const staff = useState<StaffIdentity | null>('staff-identity', () => null)
  async function refresh() {
    const result = await $fetch('/api/auth/me')
    staff.value = result.staff
    return result.staff
  }
  async function login(email: string, password: string) {
    const result = await $fetch('/api/auth/login', { method: 'POST', headers: { 'x-toli-request': '1' }, body: { email, password } })
    staff.value = result.staff
  }
  async function logout() {
    try { await $fetch('/api/auth/logout', { method: 'POST', headers: { 'x-toli-request': '1' }, body: {} }) }
    finally { staff.value = null }
  }
  return { staff, refresh, login, logout }
}
