<script setup lang="ts">
import type { AppointmentData, AppointmentRecord } from '#shared/types/appointments'
import type { AvailabilitySlot } from '#shared/types/booking'
import { customerSchema } from '#shared/schemas/customer'

const props = defineProps<{ data: AppointmentData, appointment?: AppointmentRecord | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const saving = ref(false)
const loadingSlots = ref(false)
const message = ref('')
const slots = ref<AvailabilitySlot[]>([])
let availabilityRequest = 0
const form = reactive({ serviceId: '', barberId: '', date: '', startsAt: '', customer: { fullName: '', phone: '', email: '' } })
const idempotencyKey = ref('')
watch(form, () => { idempotencyKey.value = '' }, { deep: true, flush: 'sync' })
watch(() => [form.serviceId, form.barberId, form.date, props.appointment?.id], () => { availabilityRequest++; loadingSlots.value = false }, { flush: 'sync' })
onScopeDispose(() => { availabilityRequest++ })

const services = computed(() => props.data.services.filter(item => item.is_active))
const barbers = computed(() => props.data.barbers.filter(barber => barber.is_active && props.data.assignments.some(item => item.barber_id === barber.id && item.service_id === form.serviceId)))

function reset() {
  const item = props.appointment
  Object.assign(form, {
    serviceId: item?.service_id || '', barberId: item?.barber_id || '',
    date: item ? appointmentLocalDate(item.starts_at, props.data.timezone) : '',
    startsAt: item?.starts_at || '',
    customer: { fullName: item?.customer_name || '', phone: item?.customer_phone || '', email: item?.customer_email || '' },
  })
  slots.value = []; message.value = ''
  if (item) loadSlots()
}

function serviceChanged() {
  form.barberId = ''; form.date = ''; form.startsAt = ''; slots.value = []
  if (barbers.value.length === 1) form.barberId = barbers.value[0]!.id
}

function selectionChanged() { form.startsAt = ''; loadSlots() }

async function loadSlots() {
  const requestId = ++availabilityRequest
  slots.value = []; message.value = ''
  if (!form.serviceId || !form.barberId || !form.date) return
  loadingSlots.value = true
  try {
    const result = await $fetch<{ slots: AvailabilitySlot[] }>('/api/dashboard/availability', {
      query: { serviceId: form.serviceId, barberId: form.barberId, date: form.date, appointmentId: props.appointment?.id },
    })
    if (requestId !== availabilityRequest) return
    slots.value = result.slots
    const originalSlot = props.appointment && result.slots.find(slot => Date.parse(slot.startsAt) === Date.parse(props.appointment!.starts_at))
    if (originalSlot) form.startsAt = originalSlot.startsAt
  }
  catch (error: unknown) {
    if (requestId !== availabilityRequest) return
    const failure = error as { data?: { statusMessage?: string } }
    message.value = failure.data?.statusMessage || 'Oraret nuk mund të ngarkoheshin.'
  }
  finally { if (requestId === availabilityRequest) loadingSlots.value = false }
}

async function submit() {
  if (saving.value) return
  message.value = ''
  const customer = customerSchema.safeParse(form.customer)
  if (!customer.success) { message.value = customer.error.issues[0]?.message || 'Kontrolloni të dhënat e klientit.'; return }
  if (!form.serviceId || !form.barberId || !form.startsAt) { message.value = 'Zgjidhni shërbimin, berberin dhe një orar të lirë.'; return }
  saving.value = true
  try {
    if (!idempotencyKey.value) idempotencyKey.value = createIdempotencyKey()
    const base = { barberId: form.barberId, serviceId: form.serviceId, startsAt: form.startsAt, customer: { ...customer.data, email: customer.data.email || '' } }
    const body = props.appointment
      ? { action: 'update', id: props.appointment.id, version: props.appointment.version, ...base }
      : { action: 'create', idempotencyKey: idempotencyKey.value, ...base }
    await $fetch('/api/dashboard/appointments', { method: 'POST', headers: { 'x-toli-request': '1' }, timeout: 20_000, body })
    emit('saved')
  }
  catch (error: unknown) {
    const failure = error as { data?: { statusMessage?: string, data?: { issues?: { message: string }[] } } }
    message.value = failure.data?.data?.issues?.map(issue => issue.message).join(' · ') || failure.data?.statusMessage || 'Termini nuk mund të ruhej.'
    if ((error as { statusCode?: number }).statusCode === 409) {
      const conflictMessage = message.value
      form.startsAt = ''
      await loadSlots()
      message.value = conflictMessage
    }
  }
  finally { saving.value = false }
}

watch(() => props.appointment, reset, { immediate: true })
</script>

<template>
  <UCard>
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p class="eyebrow text-primary">{{ appointment ? 'Ndryshim' : 'Termin i ri' }}</p><h2 class="mt-2 font-display text-3xl">{{ appointment ? 'Ndrysho termin' : 'Krijo termin manualisht' }}</h2></div>
      <UButton type="button" color="neutral" variant="ghost" :disabled="saving" @click="emit('cancel')">Mbyll</UButton>
    </div>
    <p v-if="message" role="alert" class="mb-5 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">{{ message }}</p>
    <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="submit">
      <UFormField label="Shërbimi"><USelect :model-value="form.serviceId || undefined" required class="w-full" :disabled="saving" :items="services.map(service => ({ label: service.name, value: service.id }))" placeholder="Zgjidh shërbimin" @update:model-value="form.serviceId = $event || ''; serviceChanged()" /></UFormField>
      <UFormField label="Berberi"><USelect :model-value="form.barberId || undefined" required class="w-full" :disabled="saving || !form.serviceId" :items="barbers.map(barber => ({ label: barber.name, value: barber.id }))" placeholder="Zgjidh berberin" @update:model-value="form.barberId = $event || ''; selectionChanged()" /></UFormField>
      <UFormField label="Data"><UInput v-model="form.date" type="date" required class="w-full" :disabled="saving || !form.barberId" :min="localDateInZone(data.timezone)" @change="selectionChanged" /></UFormField>
      <div class="field"><span>Ora e lirë</span><div class="min-h-11 rounded-lg border border-default p-2"><span v-if="loadingSlots" class="text-sm text-muted">Po ngarkohen…</span><span v-else-if="form.date && !slots.length" class="text-sm text-muted">Nuk ka orare të lira.</span><div v-else class="flex flex-wrap gap-2"><UButton v-for="slot in slots" :key="slot.startsAt" color="neutral" variant="ghost" type="button" class="rounded-lg border px-3 py-2 text-sm font-medium" :class="form.startsAt === slot.startsAt ? 'border-primary bg-primary text-white' : 'border-default'" :aria-pressed="form.startsAt === slot.startsAt" @click="form.startsAt = slot.startsAt">{{ slot.localTime }}</UButton></div></div></div>
      <UFormField label="Emri dhe mbiemri" class="sm:col-span-2"><UInput v-model="form.customer.fullName" required maxlength="120" autocomplete="name" class="w-full" /></UFormField>
      <UFormField label="Telefoni"><UInput v-model="form.customer.phone" required maxlength="30" type="tel" autocomplete="tel" class="w-full" placeholder="+383 44 123 456" /></UFormField>
      <UFormField label="Emaili (opsional)"><UInput v-model="form.customer.email" maxlength="254" type="email" autocomplete="email" class="w-full" placeholder="emri@shembull.com" /></UFormField>
      <div class="flex flex-wrap gap-3 sm:col-span-2"><UButton type="submit" size="lg" :loading="saving" :disabled="saving">{{ appointment ? 'Ruaj ndryshimet' : 'Krijo termin' }}</UButton><UButton type="button" color="neutral" variant="outline" size="lg" :disabled="saving" @click="emit('cancel')">Anulo</UButton></div>
    </form>
  </UCard>
</template>

<style scoped>
.field { display:flex; flex-direction:column; gap:.5rem; font-size:.875rem; font-weight:500; }
</style>
