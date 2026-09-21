<script setup lang="ts">
import type { ManagementResource } from '#shared/schemas/management'
import type { ServiceRecord, BarberRecord, BlockRecord } from '#shared/types/management'
import { priceToMinor } from '#shared/utils/money'

const props = defineProps<{ resource: ManagementResource }>()
const { data, status, error, refresh, save, saving, message, success } = useManagement(props.resource)
const titles = { services: 'Shërbimet', barbers: 'Berberët', 'working-hours': 'Orari i punës', 'blocked-times': 'Oraret e bllokuara', settings: 'Cilësimet e berberhanes' }
useSeoMeta({ title: () => `${titles[props.resource]} | Toli Hair` })
const open = ref(false)
const selectedBarber = ref('')
const deleting = ref<BlockRecord | null>(null)
const form = reactive({ id: undefined as string | undefined, revision: undefined as number | undefined, name: '', description: '', duration_minutes: 30, price: '', is_active: true, bio: '', service_ids: [] as string[], barber_id: '', start_local: '', end_local: '', reason: '' })
const settings = reactive({ revision: 1, name: '', phone: '', address: '', timezone: '', currency: '', slot_interval_minutes: 15, minimum_notice_minutes: 60, booking_horizon_days: 60, booking_enabled: false })
const intervals = ref<{ weekday: number, start_time: string, end_time: string }[]>([])
const hoursRevision = ref(0)
const days = ['E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë', 'E diel']
const barberItems = computed(() => data.value?.barbers.map(barber => ({ label: barber.name, value: barber.id })) || [])
const modalTitle = computed(() => `${form.id ? 'Ndrysho' : 'Shto'} ${props.resource === 'services' ? 'shërbimin' : props.resource === 'barbers' ? 'berberin' : 'orarin e bllokuar'}`)
const modalDescription = computed(() => props.resource === 'services'
  ? 'Përcaktoni emrin, kohëzgjatjen dhe çmimin e shërbimit.'
  : props.resource === 'barbers'
    ? 'Plotësoni profilin e berberit. Të gjitha shërbimet caktohen automatikisht.'
    : 'Ky interval nuk do të jetë i disponueshëm për rezervime.')
const currencyDigits = computed(() => data.value?.settings.currency ? new Intl.NumberFormat('sq', { style: 'currency', currency: data.value.settings.currency }).resolvedOptions().maximumFractionDigits ?? 2 : 2)
const currencyScale = computed(() => 10 ** currencyDigits.value)
const priceStep = computed(() => 1 / currencyScale.value)
const bookingReadiness = computed(() => {
  const value = data.value
  if (!value) return { hasService: false, hasBarber: false, hasAssignment: false, hasSchedule: false, ready: false }

  const activeServiceIds = new Set(value.services.filter(service => service.is_active).map(service => service.id))
  const activeBarberIds = new Set(value.barbers.filter(barber => barber.is_active).map(barber => barber.id))
  const assignedBarberIds = new Set(value.assignments
    .filter(assignment => activeBarberIds.has(assignment.barber_id) && activeServiceIds.has(assignment.service_id))
    .map(assignment => assignment.barber_id))
  const scheduledBarberIds = new Set(value.hours.map(interval => interval.barber_id))
  const hasSchedule = [...assignedBarberIds].some(barberId => scheduledBarberIds.has(barberId))

  return {
    hasService: activeServiceIds.size > 0,
    hasBarber: activeBarberIds.size > 0,
    hasAssignment: assignedBarberIds.size > 0,
    hasSchedule,
    ready: activeServiceIds.size > 0 && activeBarberIds.size > 0 && assignedBarberIds.size > 0 && hasSchedule,
  }
})
const bookingReadinessMessage = computed(() => {
  const readiness = bookingReadiness.value
  if (!readiness.hasService) return 'Aktivizoni së paku një shërbim.'
  if (!readiness.hasBarber) return 'Aktivizoni së paku një berber.'
  if (!readiness.hasAssignment) return 'Shërbimet janë krijuar, por asnjë shërbim aktiv nuk i është caktuar një berberi aktiv. Hapni Berberët, klikoni “Ndrysho” dhe zgjidhni shërbimet që ofron.'
  if (!readiness.hasSchedule) return 'Berberi që ofron shërbimin nuk ka orar pune. Shtoni orarin për të njëjtin berber.'
  return ''
})
function priceLabel(price: number) {
  const currency = data.value?.settings.currency
  return currency ? new Intl.NumberFormat('sq', { style: 'currency', currency }).format(price / currencyScale.value) : `${price} njësi të vogla`
}
function localTime(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: data.value?.settings.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const part = (key: string) => parts.find(p => p.type === key)?.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
function blockLabel(value: string) { return localTime(value).replace('T', ' ') }
function serviceNames(barberId: string) {
  const value = data.value
  return value?.services.filter(s => value.assignments.some(a => a.barber_id === barberId && a.service_id === s.id)).map(s => s.name).join(', ') || 'Nuk ka shërbime të caktuara'
}
function reset() {
  Object.assign(form, { id: undefined, revision: undefined, name: '', description: '', duration_minutes: 30, price: '', is_active: true, bio: '', service_ids: [], barber_id: data.value?.barbers[0]?.id || '', start_local: '', end_local: '', reason: '' })
  message.value = ''; success.value = ''; open.value = true
}
function editService(row: ServiceRecord) { reset(); Object.assign(form, row, { price: (row.price_minor / currencyScale.value).toFixed(currencyDigits.value) }) }
function editBarber(row: BarberRecord) { reset(); Object.assign(form, row) }
function editBlock(row: BlockRecord) { reset(); Object.assign(form, row, { start_local: localTime(row.starts_at), end_local: localTime(row.ends_at) }) }
function loadHours() {
  const barber = data.value?.barbers.find(b => b.id === selectedBarber.value)
  hoursRevision.value = barber?.revision || 0
  intervals.value = data.value?.hours.filter(h => h.barber_id === selectedBarber.value).map(h => ({ weekday: h.weekday, start_time: h.start_time.slice(0, 5), end_time: h.end_time.slice(0, 5) })) || []
}
function dayIntervals(weekday: number) { return intervals.value.filter(interval => interval.weekday === weekday) }
function toggleDay(weekday: number, enabled: boolean) {
  intervals.value = intervals.value.filter(interval => interval.weekday !== weekday)
  if (enabled) intervals.value.push({ weekday, start_time: '09:00', end_time: '20:00' })
}
function addShift(weekday: number) {
  const current = dayIntervals(weekday)
  if (!current.length) { toggleDay(weekday, true); return }
  if (current.length === 1 && current[0]?.start_time === '09:00' && current[0]?.end_time === '20:00') {
    current[0].end_time = '13:00'
    intervals.value.push({ weekday, start_time: '14:00', end_time: '20:00' })
    return
  }
  intervals.value.push({ weekday, start_time: '14:00', end_time: '18:00' })
}
function removeShift(interval: { weekday: number, start_time: string, end_time: string }) {
  const index = intervals.value.indexOf(interval)
  if (index >= 0) intervals.value.splice(index, 1)
}
function applyStandardWeek() {
  intervals.value = intervals.value.filter(interval => interval.weekday > 5)
  for (let weekday = 1; weekday <= 5; weekday++) intervals.value.push({ weekday, start_time: '09:00', end_time: '20:00' })
}
function copyMondayToWeekdays() {
  const monday = dayIntervals(1)
  if (!monday.length) return
  intervals.value = intervals.value.filter(interval => interval.weekday === 1 || interval.weekday > 5)
  for (let weekday = 2; weekday <= 5; weekday++) {
    intervals.value.push(...monday.map(interval => ({ weekday, start_time: interval.start_time, end_time: interval.end_time })))
  }
}
async function submitHours() {
  await save({ id: selectedBarber.value, revision: hoursRevision.value, intervals: intervals.value.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })) })
}
watch(selectedBarber, loadHours)
watch(data, value => {
  if (!value) return
  Object.assign(settings, { ...value.settings, phone: value.settings.phone || '', address: value.settings.address || '', timezone: value.settings.timezone || '', currency: value.settings.currency || '' })
  if (!selectedBarber.value) selectedBarber.value = value.barbers[0]?.id || ''
  loadHours()
})
async function submit() {
  const identity = form.id ? { id: form.id, revision: form.revision } : {}
  let payload: unknown
  if (props.resource === 'services') {
    const minor = priceToMinor(form.price, currencyDigits.value)
    if (minor === null) { message.value = 'Shkruani një çmim të vlefshëm me numrin e saktë të shifrave dhjetore.'; return }
    payload = { ...identity, name: form.name, description: form.description, duration_minutes: Number(form.duration_minutes), price_minor: minor, is_active: form.is_active }
  }
  else if (props.resource === 'barbers') payload = { ...identity, name: form.name, bio: form.bio, service_ids: data.value?.services.map(service => service.id) || [], is_active: form.is_active }
  else payload = { ...identity, barber_id: form.barber_id, start_local: form.start_local, end_local: form.end_local, reason: form.reason }
  if (await save(payload)) open.value = false
}
async function submitSettings() {
  await save({ revision: settings.revision, name: settings.name, phone: settings.phone, address: settings.address, slot_interval_minutes: Number(settings.slot_interval_minutes), minimum_notice_minutes: Number(settings.minimum_notice_minutes), booking_horizon_days: Number(settings.booking_horizon_days) })
}
async function toggleBooking() {
  if (saving.value) return
  const enabling = !settings.booking_enabled
  if (enabling && !bookingReadiness.value.ready) {
    message.value = bookingReadinessMessage.value
    success.value = ''
    return
  }
  saving.value = true; message.value = ''; success.value = ''
  try {
    await $fetch('/api/dashboard/booking-status', { method: 'POST', headers: { 'x-toli-request': '1' }, body: { enabled: enabling, revision: settings.revision } })
    await refresh()
    success.value = enabling ? 'Rezervimi në internet u aktivizua.' : 'Rezervimi në internet u çaktivizua.'
  }
  catch (error: unknown) {
    const failure = error as { data?: { statusMessage?: string } }
    message.value = failure.data?.statusMessage || 'Statusi i rezervimit nuk mund të ndryshohej.'
  }
  finally { saving.value = false }
}
async function removeBlock() {
  if (deleting.value && await save({ id: deleting.value.id, revision: deleting.value.revision, action: 'delete' })) deleting.value = null
}
</script>

<template>
  <section class="max-w-5xl">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="sr-only">{{ titles[resource] }}</h1>
      <UButton v-if="['services', 'barbers', 'blocked-times'].includes(resource) && data" icon="i-lucide-plus" size="lg" :disabled="saving || (resource === 'services' && !data.settings.currency) || (resource === 'blocked-times' && (!data.settings.timezone || !data.barbers.length))" @click="reset">{{ resource === 'services' ? 'Shto shërbim' : resource === 'barbers' ? 'Shto berber' : 'Blloko orar' }}</UButton>
    </div>
    <p v-if="status === 'pending' && !data" role="status">Po ngarkohen të dhënat e berberhanes…</p>
    <UAlert v-if="error" color="error" title="Të dhënat nuk mund të ngarkoheshin" description="Kontrolloni lidhjen dhe provoni përsëri." class="mb-6" />
    <UButton v-if="error" variant="outline" @click="refresh()">Provo përsëri</UButton>
    <p v-if="message" role="alert" class="mb-5 rounded-lg border border-error p-4 text-sm text-error">{{ message }} <UButton color="neutral" variant="ghost" type="button" class="ml-2 underline" :disabled="saving" @click="refresh(); open = false; message = ''">Ringarko të dhënat</UButton></p>
    <p v-if="success" role="status" class="mb-5 text-sm text-success">{{ success }}</p>
    <template v-if="data">

      <UModal v-model:open="open" :title="modalTitle" :description="modalDescription" scrollable :dismissible="!saving" :ui="{ content: 'sm:max-w-2xl' }">
        <template #body>
          <form class="space-y-6" @submit.prevent="submit">
            <UAlert v-if="message" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Ndryshimet nuk u ruajtën" :description="message" />
            <fieldset :disabled="saving" class="grid gap-5 sm:grid-cols-2">
            <template v-if="resource === 'services' || resource === 'barbers'">
              <UFormField label="Emri" required class="sm:col-span-2"><UInput v-model="form.name" required minlength="2" maxlength="120" size="lg" class="w-full" autofocus /></UFormField>
              <UFormField v-if="resource === 'services'" label="Përshkrimi" class="sm:col-span-2"><UTextarea v-model="form.description" maxlength="2000" :rows="4" autoresize class="w-full" placeholder="Përshkruani shkurt shërbimin…" /></UFormField>
              <UFormField v-else label="Rreth këtij berberi" class="sm:col-span-2"><UTextarea v-model="form.bio" maxlength="2000" :rows="4" autoresize class="w-full" placeholder="Përvoja, specializimi ose një përshkrim i shkurtër…" /></UFormField>
              <template v-if="resource === 'services'">
                <UFormField label="Kohëzgjatja" description="Në minuta" required><UInputNumber v-model="form.duration_minutes" :min="5" :max="480" :step="5" size="lg" class="w-full" /></UFormField>
                <UFormField :label="`Çmimi (${data.settings.currency})`" required><UInput v-model="form.price" type="number" required min="0" :step="priceStep" size="lg" class="w-full"><template #trailing><span class="text-sm text-muted">€</span></template></UInput></UFormField>
              </template>
              <UAlert v-else class="sm:col-span-2" color="neutral" variant="subtle" icon="i-lucide-sparkles" title="Shërbimet caktohen automatikisht" description="Çdo berber ofron të gjitha shërbimet aktuale dhe ato që shtohen në të ardhmen." />
              <USwitch v-model="form.is_active" :label="form.is_active ? 'Aktiv' : 'Joaktiv'" description="Vetëm elementet aktive shfaqen te rezervimi online." class="sm:col-span-2" />
            </template>
            <template v-else>
              <UFormField label="Berberi" class="sm:col-span-2"><USelect :model-value="form.barber_id || undefined" required class="w-full" :items="data.barbers.map(barber => ({ label: barber.name, value: barber.id }))" placeholder="Zgjidh" @update:model-value="form.barber_id = $event || ''" /></UFormField>
              <p class="text-sm text-muted sm:col-span-2">Orët janë sipas zonës {{ data.settings.timezone }}. Për një ditë të plotë përdorni 00:00 deri në 00:00 të ditës pasuese. Ora e përfundimit nuk përfshihet.</p>
              <UFormField label="Fillimi"><UInput v-model="form.start_local" type="datetime-local" required class="w-full" /></UFormField>
              <UFormField label="Përfundimi"><UInput v-model="form.end_local" type="datetime-local" required class="w-full" /></UFormField>
              <UFormField label="Arsyeja" class="sm:col-span-2"><UTextarea v-model="form.reason" maxlength="500" :rows="2" class="w-full" placeholder="Ditë e lirë, pushim vjetor, pauzë…" /></UFormField>
            </template>
            </fieldset>
            <div class="flex flex-col-reverse gap-3 border-t border-default pt-5 sm:flex-row sm:justify-end"><UButton type="button" color="neutral" variant="ghost" :disabled="saving" @click="open = false">Anulo</UButton><UButton type="submit" icon="i-lucide-check" :loading="saving" :disabled="saving">Ruaj ndryshimet</UButton></div>
          </form>
        </template>
      </UModal>

      <div v-if="resource === 'services'" class="grid gap-4 md:grid-cols-2">
        <CommonEmptyState v-if="!data.services.length" title="Krijoni listën e shërbimeve" description="Shtoni shërbimin e parë me kohëzgjatjen dhe çmimin e tij." />
        <UCard v-for="service in data.services" :key="service.id" class="group"><div class="flex h-full flex-col"><div class="flex items-start justify-between gap-4"><div class="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><UIcon name="i-lucide-scissors" class="size-5" /></div><UBadge :color="service.is_active ? 'success' : 'neutral'" variant="subtle">{{ service.is_active ? 'Aktiv' : 'Joaktiv' }}</UBadge></div><h2 class="mt-5 text-xl font-semibold">{{ service.name }}</h2><p class="mt-2 grow whitespace-pre-wrap text-sm leading-6 text-muted">{{ service.description || 'Shërbim profesional nga ekipi Toli Hair.' }}</p><div class="mt-5 flex items-center justify-between gap-4 border-t border-default pt-4"><p class="text-sm"><strong>{{ priceLabel(service.price_minor) }}</strong><span class="text-muted"> · {{ service.duration_minutes }} min</span></p><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" :disabled="saving" :aria-label="`Ndrysho ${service.name}`" @click="editService(service)">Ndrysho</UButton></div></div></UCard>
      </div>
      <div v-if="resource === 'barbers'" class="grid gap-4 md:grid-cols-2">
        <CommonEmptyState v-if="!data.barbers.length" title="Shtoni ekipin tuaj" description="Krijoni berberin e parë. Të gjitha shërbimet do t’i caktohen automatikisht." />
        <UCard v-for="barber in data.barbers" :key="barber.id"><div class="flex h-full flex-col"><div class="flex items-start justify-between gap-4"><div class="grid size-12 place-items-center rounded-full bg-primary text-lg font-semibold text-white" aria-hidden="true">{{ barber.name.charAt(0).toUpperCase() }}</div><UBadge :color="barber.is_active ? 'success' : 'neutral'" variant="subtle">{{ barber.is_active ? 'Aktiv' : 'Joaktiv' }}</UBadge></div><h2 class="mt-4 text-xl font-semibold">{{ barber.name }}</h2><p class="mt-2 grow whitespace-pre-wrap text-sm leading-6 text-muted">{{ barber.bio || 'Pjesë e ekipit profesional të Toli Hair.' }}</p><p class="mt-4 line-clamp-2 text-xs leading-5 text-muted"><UIcon name="i-lucide-sparkles" class="mr-1 inline size-3.5 text-primary" />{{ serviceNames(barber.id) }}</p><div class="mt-4 border-t border-default pt-3 text-right"><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" :disabled="saving" :aria-label="`Ndrysho ${barber.name}`" @click="editBarber(barber)">Ndrysho</UButton></div></div></UCard>
      </div>

      <div v-if="resource === 'working-hours'" class="space-y-5">
        <CommonEmptyState v-if="!data.barbers.length" title="Së pari shtoni një berber" description="Orari i punës konfigurohet veçmas për secilin berber." label="Shko te berberët" to="/dashboard/barbers" />
        <form v-else class="space-y-5" @submit.prevent="submitHours">
          <UCard>
            <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <UFormField label="Orari për berberin" description="Zgjidhni berberin që dëshironi të konfiguroni." class="max-w-md"><USelect v-model="selectedBarber" :items="barberItems" value-key="value" size="xl" icon="i-lucide-user-round" class="w-full" :disabled="saving" /></UFormField>
              <div class="flex flex-wrap gap-2"><UButton type="button" color="neutral" variant="outline" icon="i-lucide-wand-sparkles" :disabled="saving" @click="applyStandardWeek">Orari standard 09–17</UButton><UButton type="button" color="neutral" variant="ghost" icon="i-lucide-copy" :disabled="saving || !dayIntervals(1).length" @click="copyMondayToWeekdays">Kopjo të hënën</UButton></div>
            </div>
            <div class="mt-5 flex items-start gap-3 rounded-xl bg-elevated p-4 text-sm leading-6 text-muted"><UIcon name="i-lucide-clock-3" class="mt-0.5 size-5 shrink-0 text-primary" /><p>Zona kohore: <strong class="text-default">Kosovë (Europe/Belgrade)</strong>. Çaktivizimi i një dite e shënon si ditë pushimi. Për pauzë, ndajeni ditën në dy pjesë.</p></div>
          </UCard>

          <fieldset :disabled="saving" class="grid gap-4">
            <article v-for="(day, dayIndex) in days" :key="day" class="schedule-day" :class="dayIntervals(dayIndex + 1).length ? 'schedule-day-open' : ''">
              <div class="flex flex-wrap items-center justify-between gap-4 border-b border-default/70 p-4 sm:px-5">
                <USwitch :model-value="dayIntervals(dayIndex + 1).length > 0" :label="day" :description="dayIntervals(dayIndex + 1).length ? `${dayIntervals(dayIndex + 1).length === 1 ? 'Një orar pune' : `${dayIntervals(dayIndex + 1).length} pjesë pune`}` : 'Ditë pushimi'" @update:model-value="toggleDay(dayIndex + 1, $event)" />
                <UButton v-if="dayIntervals(dayIndex + 1).length" type="button" color="neutral" variant="soft" size="sm" icon="i-lucide-split" :disabled="intervals.length >= 28" @click="addShift(dayIndex + 1)">Ndaje orarin</UButton>
              </div>
              <div v-if="dayIntervals(dayIndex + 1).length" class="grid gap-3 p-4 sm:px-5">
                <div v-for="(interval, intervalIndex) in dayIntervals(dayIndex + 1)" :key="`${dayIndex}-${intervalIndex}`" class="shift-row">
                  <div class="hidden size-9 place-items-center rounded-full bg-elevated text-sm font-semibold text-muted sm:grid">{{ intervalIndex + 1 }}</div>
                  <UFormField :label="intervalIndex === 0 ? 'Fillimi' : 'Rikthimi'"><UInput v-model="interval.start_time" type="time" required size="lg" class="w-full sm:w-36" /></UFormField>
                  <UIcon name="i-lucide-arrow-right" class="mt-7 hidden size-4 text-muted sm:block" />
                  <UFormField :label="intervalIndex === 0 ? 'Përfundimi' : 'Deri'"><UInput v-model="interval.end_time" required pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00" placeholder="20:00" size="lg" class="w-full sm:w-36" /></UFormField>
                  <UButton v-if="dayIntervals(dayIndex + 1).length > 1" type="button" color="error" variant="ghost" icon="i-lucide-trash-2" class="sm:mt-6" :aria-label="`Hiq pjesën ${intervalIndex + 1} për ${day}`" @click="removeShift(interval)" />
                </div>
              </div>
            </article>
          </fieldset>

          <div class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-default bg-default/95 p-4 shadow-lg backdrop-blur"><p class="text-sm text-muted"><strong class="text-default">{{ intervals.length }}</strong> {{ intervals.length === 1 ? 'orar i konfiguruar' : 'orare të konfiguruara' }}</p><UButton type="submit" size="lg" icon="i-lucide-check" :loading="saving" :disabled="saving">Ruaj orarin e punës</UButton></div>
        </form>
      </div>

      <div v-if="resource === 'blocked-times'" class="grid gap-4">
        <p class="text-sm text-muted">Të gjitha orët shfaqen sipas {{ data.settings.timezone || 'zonës kohore të berberhanes' }}. Bllokimet që bien ndesh me termine të konfirmuara nuk mund të ruhen.</p>
        <UCard v-if="deleting"><h2 class="font-medium">Ta hiqni këtë orar të bllokuar?</h2><p class="my-3 text-sm text-muted">{{ deleting.reason || 'Orar i bllokuar' }} — heqja e tij e bën këtë orar sërish të disponueshëm, në varësi të orarit të berberit.</p><div class="flex gap-3"><UButton color="error" :loading="saving" :disabled="saving" @click="removeBlock">Hiq bllokimin</UButton><UButton color="neutral" variant="outline" :disabled="saving" @click="deleting = null">Anulo</UButton></div></UCard>
        <CommonEmptyState v-if="!data.blocks.length" title="Nuk ka orare të bllokuara" description="Shtoni një pauzë, ditë të lirë ose pushim vjetor për një berber." />
        <UCard v-for="block in data.blocks" :key="block.id"><div class="flex flex-wrap justify-between gap-4"><div><h2 class="font-medium">{{ data.barbers.find(b => b.id === block.barber_id)?.name }}</h2><p class="mt-2 text-sm">{{ blockLabel(block.starts_at) }} → {{ blockLabel(block.ends_at) }}</p><p class="mt-2 whitespace-pre-wrap text-sm text-muted">{{ block.reason }}</p></div><div class="flex gap-2"><UButton variant="outline" color="neutral" :disabled="saving" @click="editBlock(block)">Ndrysho</UButton><UButton variant="ghost" color="error" :disabled="saving" @click="deleting = block">Hiq</UButton></div></div></UCard>
      </div>

      <UCard v-if="resource === 'settings'">
        <form class="space-y-6" @submit.prevent="submitSettings">
          <fieldset :disabled="saving" class="grid gap-5 sm:grid-cols-2">
            <UFormField label="Emri i berberhanes" class="sm:col-span-2"><UInput v-model="settings.name" required minlength="2" maxlength="120" class="w-full" /></UFormField>
            <UFormField label="Telefoni"><UInput v-model="settings.phone" type="tel" maxlength="40" class="w-full" /></UFormField>
            <UFormField label="Adresa"><UInput v-model="settings.address" maxlength="500" class="w-full" /></UFormField>
            <div class="field sm:col-span-2">Zona kohore<div class="control bg-elevated" role="status">Europe/Belgrade — Kosovë (CET/CEST)</div><p class="text-xs font-normal text-muted">Zona kohore caktohet automatikisht për Kosovën dhe nuk mund të ndryshohet.</p></div>
            <UFormField label="Intervali i termineve (minuta)"><UInput v-model.number="settings.slot_interval_minutes" type="number" required min="5" max="120" step="1" class="w-full" /></UFormField>
            <UFormField label="Njoftimi minimal (minuta)"><UInput v-model.number="settings.minimum_notice_minutes" type="number" required min="0" max="10080" step="1" class="w-full" /></UFormField>
            <UFormField label="Rezervim deri në (ditë përpara)"><UInput v-model.number="settings.booking_horizon_days" type="number" required min="1" max="365" step="1" class="w-full" /></UFormField>
          </fieldset>
          <p class="text-sm leading-6 text-muted">Të gjitha çmimet ruhen dhe shfaqen vetëm në euro (€).</p>
          <UButton type="submit" :loading="saving" :disabled="saving">Ruaj cilësimet</UButton>
        </form>
        <div class="mt-8 border-t border-default pt-6">
          <h2 class="font-display text-2xl">Rezervimi në internet</h2>
          <p class="mt-2 text-sm leading-6 text-muted">Statusi aktual: <strong>{{ settings.booking_enabled ? 'Aktiv' : 'Joaktiv' }}</strong>.</p>
          <ul class="mt-4 grid gap-2 text-sm" aria-label="Kushtet për aktivizimin e rezervimeve">
            <li class="flex items-center gap-2"><span :class="bookingReadiness.hasService ? 'text-success' : 'text-error'" aria-hidden="true">{{ bookingReadiness.hasService ? '✓' : '✕' }}</span> Së paku një shërbim aktiv</li>
            <li class="flex items-center gap-2"><span :class="bookingReadiness.hasBarber ? 'text-success' : 'text-error'" aria-hidden="true">{{ bookingReadiness.hasBarber ? '✓' : '✕' }}</span> Së paku një berber aktiv</li>
            <li class="flex items-center gap-2"><span :class="bookingReadiness.hasAssignment ? 'text-success' : 'text-error'" aria-hidden="true">{{ bookingReadiness.hasAssignment ? '✓' : '✕' }}</span> Një shërbim aktiv i caktuar te një berber aktiv</li>
            <li class="flex items-center gap-2"><span :class="bookingReadiness.hasSchedule ? 'text-success' : 'text-error'" aria-hidden="true">{{ bookingReadiness.hasSchedule ? '✓' : '✕' }}</span> Orar pune për të njëjtin berber</li>
          </ul>
          <p v-if="!settings.booking_enabled && !bookingReadiness.ready" class="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6" role="status">{{ bookingReadinessMessage }}</p>
          <div v-if="!settings.booking_enabled && !bookingReadiness.hasAssignment && bookingReadiness.hasBarber" class="mt-3">
            <UButton to="/dashboard/barbers" color="neutral" variant="outline">Cakto shërbimet te berberët</UButton>
          </div>
          <div v-else-if="!settings.booking_enabled && bookingReadiness.hasAssignment && !bookingReadiness.hasSchedule" class="mt-3">
            <UButton to="/dashboard/working-hours" color="neutral" variant="outline">Shto orarin e punës</UButton>
          </div>
          <UButton class="mt-4" :color="settings.booking_enabled ? 'error' : 'primary'" :variant="settings.booking_enabled ? 'outline' : 'solid'" :loading="saving" :disabled="saving" @click="toggleBooking">{{ settings.booking_enabled ? 'Çaktivizo rezervimet' : 'Aktivizo rezervimet' }}</UButton>
        </div>
      </UCard>
    </template>
  </section>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: .5rem; font-size: .875rem; font-weight: 500; }
.control:disabled { opacity: .6; }
input[type=checkbox] { accent-color: var(--ui-primary); width: 1rem; height: 1rem; }
.schedule-day { overflow: hidden; border: 1px solid var(--ui-border); border-radius: .625rem; background: color-mix(in srgb, var(--ui-bg-elevated) 45%, var(--ui-bg)); transition: border-color .15s, box-shadow .15s, background .15s; }
.schedule-day-open { border-color: color-mix(in srgb, var(--ui-primary) 32%, var(--ui-border)); background: var(--ui-bg); box-shadow: 0 .5rem 1.8rem rgb(41 39 37 / .045); }
.shift-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; align-items: end; gap: .75rem; border-radius: .5rem; background: var(--ui-bg-elevated); padding: .85rem; }
@media (min-width: 640px) { .shift-row { grid-template-columns: auto auto auto auto 1fr; align-items: center; background: transparent; padding: .25rem 0; } }
</style>
