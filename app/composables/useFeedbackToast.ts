import type { Ref } from 'vue'

/** Keep field errors visible while also announcing action feedback globally. */
export function useFeedbackToast(message?: Ref<string>, successMessage?: Ref<string>) {
  const toast = useToast()
  function success(title: string) {
    toast.add({ title, color: 'success', icon: 'i-lucide-circle-check', duration: 5000 })
  }
  function error(description: string) {
    toast.add({ title: 'Veprimi nuk u krye', description, color: 'error', icon: 'i-lucide-circle-alert', duration: 8000 })
  }
  if (message) watch(message, value => { if (value) error(value) })
  if (successMessage) watch(successMessage, value => { if (value) success(value) })
  return { success, error }
}
