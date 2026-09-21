import type { ManagementData } from '#shared/types/management'
import type { ManagementResource } from '#shared/schemas/management'

export function useManagement(resource: ManagementResource) {
  const request = useFetch<ManagementData>(`/api/dashboard/${resource}`, { server: false, key: `management-${resource}` })
  const saving = ref(false)
  const message = ref('')
  const success = ref('')
  async function save(body: unknown) {
    if (saving.value) return false
    saving.value = true; message.value = ''; success.value = ''
    try {
      await $fetch(`/api/dashboard/${resource}`, { method: 'POST', headers: { 'x-toli-request': '1' }, body: body as Record<string, unknown> })
      await request.refresh()
      success.value = 'Ndryshimet u ruajtën.'
      return true
    }
    catch (error: unknown) {
      const e = error as { data?: { statusMessage?: string, data?: { issues?: { message: string }[] } } }
      message.value = e.data?.data?.issues?.map(i => i.message).join(' · ') || e.data?.statusMessage || 'Ndryshimet nuk mund të ruheshin. Ju lutemi provoni përsëri.'
      return false
    }
    finally { saving.value = false }
  }
  return { ...request, saving, message, success, save }
}
