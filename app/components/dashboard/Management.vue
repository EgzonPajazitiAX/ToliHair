<script setup lang="ts">
import type { ManagementResource } from '#shared/schemas/management'
import type { ServiceRecord, BarberRecord, BlockRecord } from '#shared/types/management'
import { priceToMinor } from '#shared/utils/money'
import { moveService } from '#shared/utils/service-order'

const props = defineProps<{ resource: ManagementResource }>()
const { data, status, error, refresh, save, saving, message, success } = useManagement(props.resource)
const titles = { services: 'Shërbimet', barbers: 'Berberët', 'working-hours': 'Orari i punës', 'blocked-times': 'Oraret e bllokuara', settings: 'Cilësimet e berberhanes' }
useSeoMeta({ title: () => `${titles[props.resource]} | Toli Hair` })
const open = ref(false)
const serviceOrder = ref<string[]>([])
const serviceDrag = ref<{ id: string, target: string, pointer: number, x: number, y: number, startX: number, startY: number, moved: boolean } | null>(null)
const servicePreviewOrder = computed(() => serviceDrag.value?.moved && serviceDrag.value.target
  ? moveService(serviceOrder.value, serviceDrag.value.id, serviceDrag.value.target)
  : serviceOrder.value)
const orderedServices = computed(() => {
  const records = new Map(data.value?.services.map(service => [service.id, service]))
  return servicePreviewOrder.value.map(id => records.get(id)).filter((service): service is ServiceRecord => !!service)
})
const orderAnnouncement = ref('')
watch(() => data.value?.services, services => { serviceOrder.value = services?.map(service => service.id) || [] }, { immediate: true })
async function persistServiceOrder(source: string, target: string) {
  if (saving.value || source === target || !data.value) return
  const previous = [...serviceOrder.value]
  const next = moveService(previous, source, target)
  if (next.every((id, index) => id === previous[index])) return
  const revisions = new Map(data.value.services.map(service => [service.id, service.revision]))
  serviceOrder.value = next
  orderAnnouncement.value = 'Po ruhet renditja…'
  const stored = await save({ action: 'reorder', services: next.map(id => ({ id, revision: revisions.get(id) })) })
  if (!stored) {
    serviceOrder.value = previous
    orderAnnouncement.value = 'Renditja nuk u ruajt. Provo përsëri ose ringarko të dhënat.'
  }
  else { success.value = 'Renditja e shërbimeve u ruajt.'; orderAnnouncement.value = success.value }
}
function startServiceDrag(event: PointerEvent, id: string) {
  if (saving.value || open.value || !event.isPrimary || event.button !== 0 || serviceOrder.value.length < 2) return
  // Buttons, links and form fields retain their normal interaction.
  if ((event.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return
  const card = event.currentTarget as HTMLElement
  const sorter = card.closest<HTMLElement>('[data-service-sorter]')
  if (!sorter) return
  event.preventDefault()
  card.focus({ preventScroll: true })
  // Capture on the stationary grid: the source card moves during preview.
  sorter.setPointerCapture(event.pointerId)
  serviceDrag.value = { id, target: id, pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false }
}
function updateServiceDrag(event: PointerEvent) {
  const drag = serviceDrag.value
  if (!drag || drag.pointer !== event.pointerId) return
  drag.x = event.clientX; drag.y = event.clientY
  if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6) drag.moved = true
  if (!drag.moved) return
  const hit = document.elementFromPoint(drag.x, drag.y)
  const card = hit?.closest<HTMLElement>('[data-service-id]')
  const slot = card?.closest('[data-service-sorter]') ? servicePreviewOrder.value.indexOf(card.dataset.serviceId || '') : -1
  // Map the visible slot to the original order, so a moved card under the
  // pointer cannot cause the preview to jump back and forth.
  drag.target = slot >= 0 ? serviceOrder.value[slot] || '' : ''
  // Scroll the dashboard's actual scroll container, not the window.
  let container = (event.currentTarget as HTMLElement).parentElement
  while (container) {
    if (container.scrollHeight > container.clientHeight && /auto|scroll/.test(getComputedStyle(container).overflowY)) {
      const bounds = container.getBoundingClientRect()
      if (drag.y < bounds.top + 64) container.scrollBy(0, -18)
      else if (drag.y > bounds.bottom - 64) container.scrollBy(0, 18)
      break
    }
    container = container.parentElement
  }
}
function finishServiceDrag(event: PointerEvent) {
  if (serviceDrag.value?.pointer !== event.pointerId) return
  if (event.clientX !== serviceDrag.value.x || event.clientY !== serviceDrag.value.y) updateServiceDrag(event)
  const drag = serviceDrag.value
  serviceDrag.value = null
  if (drag?.moved && drag.target) void persistServiceOrder(drag.id, drag.target)
}
function cancelServiceDrag() { serviceDrag.value = null }
function serviceOrderKey(event: KeyboardEvent, id: string) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Escape') { cancelServiceDrag(); return }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  if (saving.value || serviceDrag.value) return
  const index = serviceOrder.value.indexOf(id)
  const target = serviceOrder.value[index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1)]
  if (target) void persistServiceOrder(id, target)
}
const selectedBarber = ref('')
const deleting = ref<BlockRecord | null>(null)
const blockFullDay = ref(false)
const blockDate = ref('')
watch([blockDate, blockFullDay], ([date, fullDay]) => {
  if (!fullDay || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
  const next = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(next.getTime())) return
  next.setUTCDate(next.getUTCDate() + 1)
  form.start_local = `${date}T00:00`
  form.end_local = `${next.toISOString().slice(0, 10)}T00:00`
})
const blockBarberItems = computed(() => [...(!form.id ? [{ label: 'Të gjithë berberët · Mbyllje e lokalit', value: 'all' }] : []), ...barberItems.value])
const blockDay = (value: string) => new Intl.DateTimeFormat('sq', { timeZone: data.value?.settings.timezone || 'UTC', day: '2-digit', month: 'short' }).format(new Date(value))
const form = reactive({ id: undefined as string | undefined, revision: undefined as number | undefined, name: '', description: '', duration_minutes: 30, price: '', is_active: true, bio: '', service_ids: [] as string[], barber_id: '', start_local: '', end_local: '', reason: '' })
const settings = reactive({ revision: 1, name: '', phone: '', address: '', timezone: '', currency: '', slot_interval_minutes: 15, minimum_notice_minutes: 60, booking_horizon_days: 60, booking_enabled: false, peak_pricing_enabled: false, peak_start_time: '17:00', peak_end_time: '20:00', peak_multiplier: 1.5 })
const intervals = ref<{ weekday: number, start_time: string, end_time: string }[]>([])
const hoursRevision = ref(0)
const savedHours = ref('[]')
const hoursDrafts = new Map<string, typeof intervals.value>()
const hoursKey = (value: typeof intervals.value) => JSON.stringify([...value].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)))
const hoursChanged = computed(() => hoursKey(intervals.value) !== savedHours.value)
const minutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN
function dayError(weekday: number) {
  const rows = [...dayIntervals(weekday)].sort((a, b) => a.start_time.localeCompare(b.start_time))
  for (const [index, row] of rows.entries()) {
    if (!Number.isFinite(minutes(row.start_time)) || row.start_time === '24:00' || !Number.isFinite(minutes(row.end_time))) return 'Shkruani orën në formatin 09:00.'
    if (minutes(row.end_time) <= minutes(row.start_time)) return 'Përfundimi duhet të jetë pas fillimit.'
    if (index && minutes(row.start_time) < minutes(rows[index - 1]!.end_time)) return 'Intervalet nuk mund të mbivendosen.'
  }
  return ''
}
const hoursInvalid = computed(() => Array.from({ length: 7 }, (_, index) => dayError(index + 1)).some(Boolean))
const openDays = computed(() => new Set(intervals.value.map(row => row.weekday)).size)
const shortDays = ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die']
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
  blockFullDay.value = false; blockDate.value = ''
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
  savedHours.value = hoursKey(intervals.value)
}
function dayIntervals(weekday: number) { return intervals.value.filter(interval => interval.weekday === weekday) }
function toggleDay(weekday: number, enabled: boolean) {
  if (enabled && !dayIntervals(weekday).length && intervals.value.length >= 28) return
  intervals.value = intervals.value.filter(interval => interval.weekday !== weekday)
  if (enabled) intervals.value.push({ weekday, start_time: '09:00', end_time: '20:00' })
}
function nextShift(weekday: number) {
  if (dayError(weekday) || intervals.value.length >= 28) return null
  const rows = [...dayIntervals(weekday)].sort((a, b) => a.start_time.localeCompare(b.start_time))
  let start = rows.length ? minutes(rows[0]!.end_time) + 30 : 540
  for (let index = 1; index < rows.length; index++) {
    if (start + 60 <= minutes(rows[index]!.start_time)) break
    start = minutes(rows[index]!.end_time) + 30
  }
  if (start + 60 > 1440) return null
  const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  return { weekday, start_time: format(start), end_time: format(start + 60) }
}
function addShift(weekday: number) {
  const row = nextShift(weekday)
  if (row) intervals.value.push(row)
}
function removeShift(interval: { weekday: number, start_time: string, end_time: string }) {
  const index = intervals.value.indexOf(interval)
  if (index >= 0) intervals.value.splice(index, 1)
}
async function submitHours() {
  if (saving.value || hoursInvalid.value || !hoursChanged.value) return
  await save({ id: selectedBarber.value, revision: hoursRevision.value, intervals: intervals.value.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })) })
}
watch(selectedBarber, (value, previous) => {
  if (previous) hoursDrafts.set(previous, intervals.value.map(row => ({ ...row })))
  loadHours()
  const draft = hoursDrafts.get(value)
  if (draft) intervals.value = draft.map(row => ({ ...row }))
})
watch(data, value => {
  if (!value) return
  Object.assign(settings, { ...value.settings, phone: value.settings.phone || '', address: value.settings.address || '', timezone: value.settings.timezone || '', currency: value.settings.currency || '', peak_start_time: value.settings.peak_start_time?.slice(0, 5) || '17:00', peak_end_time: value.settings.peak_end_time?.slice(0, 5) || '20:00' })
  if (!selectedBarber.value) selectedBarber.value = value.barbers[0]?.id || ''
  loadHours()
  hoursDrafts.delete(selectedBarber.value)
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
  else payload = form.barber_id === 'all' && !form.id
    ? { all_barbers: true, start_local: form.start_local, end_local: form.end_local, reason: form.reason }
    : { ...identity, barber_id: form.barber_id, start_local: form.start_local, end_local: form.end_local, reason: form.reason }
  if (await save(payload)) open.value = false
}
async function submitSettings() {
  await save({ revision: settings.revision, name: settings.name, phone: settings.phone, address: settings.address, slot_interval_minutes: Number(settings.slot_interval_minutes), minimum_notice_minutes: Number(settings.minimum_notice_minutes), booking_horizon_days: Number(settings.booking_horizon_days), peak_pricing_enabled: settings.peak_pricing_enabled, peak_start_time: settings.peak_start_time, peak_end_time: settings.peak_end_time, peak_multiplier: Number(settings.peak_multiplier) })
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
function updateDeleteModal(isOpen: boolean) {
  if (!isOpen && !saving.value) deleting.value = null
}
async function removeBlock() {
  if (deleting.value && await save({ id: deleting.value.id, revision: deleting.value.revision, action: 'delete' })) deleting.value = null
}
</script>

<template>
  <section class="max-w-5xl">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="sr-only">{{ titles[resource] }}</h1>
      <UButton v-if="['services', 'barbers'].includes(resource) && data" icon="i-lucide-plus" size="lg" :disabled="saving || !!serviceDrag || (resource === 'services' && !data.settings.currency)" @click="reset">{{ resource === 'services' ? 'Shto shërbim' : 'Shto berber' }}</UButton>
    </div>
    <p v-if="status === 'pending' && !data" role="status">Po ngarkohen të dhënat e berberhanes…</p>
    <UAlert v-if="error" color="error" title="Të dhënat nuk mund të ngarkoheshin" description="Kontrolloni lidhjen dhe provoni përsëri." class="mb-6" />
    <UButton v-if="error" variant="outline" @click="refresh()">Provo përsëri</UButton>
    <p v-if="message" role="alert" class="mb-5 rounded-lg border border-error p-4 text-sm text-error">{{ message }} <UButton color="neutral" variant="ghost" type="button" class="ml-2 underline" :disabled="saving" @click="refresh(); open = false; message = ''">Ringarko të dhënat</UButton></p>
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
                <UFormField label="Kohëzgjatja (minuta)" required><UInputNumber v-model="form.duration_minutes" :min="5" :max="480" :step="5" size="lg" class="w-full" /></UFormField>
                <UFormField :label="`Çmimi (${data.settings.currency})`" required><UInput v-model="form.price" type="number" required min="0" :step="priceStep" size="lg" class="w-full"><template #trailing><span class="text-sm text-muted">€</span></template></UInput></UFormField>
              </template>
              <UAlert v-else class="sm:col-span-2" color="neutral" variant="subtle" icon="i-lucide-sparkles" title="Shërbimet caktohen automatikisht" description="Çdo berber ofron të gjitha shërbimet aktuale dhe ato që shtohen në të ardhmen." />
              <USwitch v-model="form.is_active" :label="form.is_active ? 'Aktiv' : 'Joaktiv'" description="Vetëm elementet aktive shfaqen te rezervimi online." class="sm:col-span-2" />
            </template>
            <template v-else>
              <UFormField label="Për kë vlen bllokimi?" class="sm:col-span-2"><USelect :model-value="form.barber_id || undefined" required size="xl" icon="i-lucide-users-round" class="w-full" :items="blockBarberItems" placeholder="Zgjidh berberin" @update:model-value="form.barber_id = $event || ''" /></UFormField>
              <UAlert v-if="form.barber_id === 'all'" class="sm:col-span-2" color="primary" variant="subtle" icon="i-lucide-store" title="Mbyllje për të gjithë ekipin" :description="`Bllokimi zbatohet për ${data.barbers.length} berberë ekzistues, përfshirë joaktivët. Nëse ka konflikt me një termin, nuk ruhet për asnjërin.`" />
              <USwitch v-model="blockFullDay" label="Gjithë ditën" description="Për festa, ditë pushimi ose mbyllje të lokalit." class="sm:col-span-2" />
              <UFormField v-if="blockFullDay" label="Data e pushimit" class="sm:col-span-2"><UInput v-model="blockDate" type="date" required size="lg" class="w-full" /></UFormField>
              <template v-else><UFormField label="Nga"><UInput v-model="form.start_local" type="datetime-local" required size="lg" class="w-full" /></UFormField><UFormField label="Deri"><UInput v-model="form.end_local" type="datetime-local" required size="lg" class="w-full" /></UFormField></template>
              <p class="text-xs text-muted sm:col-span-2">Zona kohore: {{ data.settings.timezone }}. Terminet ekzistuese nuk anulohen automatikisht.</p>
              <UFormField label="Arsyeja" class="sm:col-span-2"><UTextarea v-model="form.reason" maxlength="500" :rows="2" class="w-full" placeholder="Ditë e lirë, pushim vjetor, pauzë…" /></UFormField>
            </template>
            </fieldset>
            <div class="flex flex-col-reverse gap-3 border-t border-default pt-5 sm:flex-row sm:justify-end"><UButton type="button" color="neutral" variant="ghost" :disabled="saving" @click="open = false">Anulo</UButton><UButton type="submit" icon="i-lucide-check" :loading="saving" :disabled="saving">Ruaj ndryshimet</UButton></div>
          </form>
        </template>
      </UModal>

      <div v-if="resource === 'services'" class="space-y-4">
        <p v-if="data.services.length > 1" id="service-order-help" class="service-sort-help"><UIcon name="i-lucide-move" class="size-5 shrink-0 text-primary" /><span>Kape kartën dhe vendose në rendin që dëshiron.<small>Shiko renditjen paraprakisht; lëshoje për ta ruajtur. Mund të përdorësh edhe shigjetat e tastierës.</small></span></p>
        <p class="sr-only" role="status" aria-live="polite">{{ orderAnnouncement }}</p>
        <div data-service-sorter class="grid gap-4 md:grid-cols-2" :aria-busy="saving" @pointermove="updateServiceDrag" @pointerup="finishServiceDrag" @pointercancel="cancelServiceDrag" @lostpointercapture="cancelServiceDrag">
        <CommonEmptyState v-if="!data.services.length" title="Krijoni listën e shërbimeve" description="Shtoni shërbimin e parë me kohëzgjatjen dhe çmimin e tij." />
        <article v-for="(service, index) in orderedServices" :key="service.id" :data-service-id="service.id" class="service-sort-card" :class="{ 'service-sort-source': serviceDrag?.moved && serviceDrag.id === service.id, 'service-sort-disabled': saving || data.services.length < 2 }" :tabindex="data.services.length > 1 ? 0 : undefined" :aria-label="`${service.name}, pozicioni ${index + 1} nga ${data.services.length}`" :aria-describedby="data.services.length > 1 ? 'service-order-help' : undefined" @pointerdown="startServiceDrag($event, service.id)" @keydown="serviceOrderKey($event, service.id)">
          <UCard class="h-full service-sort-content" :ui="{ body: 'h-full' }"><div class="flex h-full flex-col"><div class="flex items-start justify-between gap-4"><span class="service-position">{{ String(index + 1).padStart(2, '0') }}</span><UBadge :color="service.is_active ? 'success' : 'neutral'" variant="subtle">{{ service.is_active ? 'Aktiv' : 'Joaktiv' }}</UBadge></div><h2 class="mt-5 text-xl font-semibold">{{ service.name }}</h2><p class="mt-2 grow whitespace-pre-wrap text-sm leading-6 text-muted">{{ service.description || 'Shërbim profesional nga ekipi Toli Hair.' }}</p><div class="mt-5 flex items-center justify-between gap-4 border-t border-default pt-4"><p class="text-sm"><strong>{{ priceLabel(service.price_minor) }}</strong><span class="text-muted"> · {{ service.duration_minutes }} min</span></p><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" :disabled="saving || !!serviceDrag" :aria-label="`Ndrysho ${service.name}`" @click="editService(service)">Ndrysho</UButton></div></div></UCard>
          <div v-if="serviceDrag?.moved && serviceDrag.id === service.id" class="service-drop-slot" aria-hidden="true"><UIcon name="i-lucide-move" class="size-6" /><strong>Lësho këtu</strong><span>Pozicioni {{ index + 1 }}</span></div>
        </article>
        </div>
        <div v-if="serviceDrag?.moved" class="service-drag-preview" aria-hidden="true" :style="{ left: `clamp(7rem, ${serviceDrag.x}px, calc(100vw - 7rem))`, top: `${serviceDrag.y}px` }"><UIcon name="i-lucide-move" class="size-4 shrink-0" />{{ data.services.find(service => service.id === serviceDrag?.id)?.name }}</div>
      </div>
      <div v-if="resource === 'barbers'" class="grid gap-4 md:grid-cols-2">
        <CommonEmptyState v-if="!data.barbers.length" title="Shtoni ekipin tuaj" description="Krijoni berberin e parë. Të gjitha shërbimet do t’i caktohen automatikisht." />
        <UCard v-for="barber in data.barbers" :key="barber.id"><div class="flex h-full flex-col"><div class="flex items-start justify-between gap-4"><div class="grid size-12 place-items-center rounded-full bg-primary text-lg font-semibold text-white" aria-hidden="true">{{ barber.name.charAt(0).toUpperCase() }}</div><UBadge :color="barber.is_active ? 'success' : 'neutral'" variant="subtle">{{ barber.is_active ? 'Aktiv' : 'Joaktiv' }}</UBadge></div><h2 class="mt-4 text-xl font-semibold">{{ barber.name }}</h2><p class="mt-2 grow whitespace-pre-wrap text-sm leading-6 text-muted">{{ barber.bio || 'Pjesë e ekipit profesional të Toli Hair.' }}</p><p class="mt-4 line-clamp-2 text-xs leading-5 text-muted"><UIcon name="i-lucide-sparkles" class="mr-1 inline size-3.5 text-primary" />{{ serviceNames(barber.id) }}</p><div class="mt-4 border-t border-default pt-3 text-right"><UButton color="neutral" variant="ghost" icon="i-lucide-pencil" :disabled="saving" :aria-label="`Ndrysho ${barber.name}`" @click="editBarber(barber)">Ndrysho</UButton></div></div></UCard>
      </div>

      <div v-if="resource === 'working-hours'" class="space-y-5">
        <CommonEmptyState v-if="!data.barbers.length" title="Së pari shtoni një berber" description="Orari i punës konfigurohet veçmas për secilin berber." label="Shko te berberët" to="/dashboard/barbers" />
        <form v-else class="hours-editor" @submit.prevent="submitHours">
          <div class="hours-heading">
            <div><p class="hours-kicker">Disponueshmëria javore</p><h2>Java jote, në një pamje.</h2><p>Cakto ditët dhe orët kur klientët mund të rezervojnë.</p></div>
            <UFormField label="Berberi" class="hours-barber"><USelect v-model="selectedBarber" :items="barberItems" value-key="value" size="xl" icon="i-lucide-user-round" class="w-full" :disabled="saving" /></UFormField>
          </div>
          <div class="hours-overview">
            <div class="hours-day-count"><strong>{{ openDays }}<small>/ 7</small></strong><span>ditë pune në javë</span></div>
            <nav class="hours-week-preview" aria-label="Kalo te dita e javës">
              <a v-for="(day, index) in shortDays" :key="day" :href="`#hours-day-${index + 1}`" :class="{ 'preview-day-open': dayIntervals(index + 1).length, 'preview-day-error': dayError(index + 1) }" :aria-label="`${days[index]}: ${dayIntervals(index + 1).length ? 'ditë pune' : 'pushim'}`"><span>{{ day }}</span><UIcon :name="dayError(index + 1) ? 'i-lucide-circle-alert' : dayIntervals(index + 1).length ? 'i-lucide-check' : 'i-lucide-minus'" class="size-3.5" /></a>
            </nav>
          </div>
          <div v-if="hoursChanged || saving" class="hours-savebar" aria-label="Ruajtja e ndryshimeve">
            <div class="hours-save-message" role="status" aria-live="polite"><UIcon :name="saving ? 'i-lucide-loader-circle' : 'i-lucide-save'" class="size-5 shrink-0" :class="{ 'animate-spin': saving }" /><p><strong>{{ saving ? 'Po ruhet orari…' : 'Ndryshimet nuk janë ruajtur' }}</strong><small>{{ hoursInvalid ? 'Korrigjo intervalet e shënuara për të vazhduar.' : 'Ruaji që të zbatohen te rezervimet online.' }}</small></p></div>
            <div class="hours-save-actions"><UButton type="button" color="neutral" variant="ghost" :disabled="saving" @click="loadHours(); hoursDrafts.delete(selectedBarber)">Rikthe</UButton><UButton type="submit" size="xl" icon="i-lucide-check" :loading="saving" :disabled="saving || hoursInvalid || !hoursChanged">Ruaj ndryshimet</UButton></div>
          </div>
          <div class="hours-layout">
            <div class="hours-week-panel">
              <div class="hours-week-title"><div><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" /><h3>Orari javor</h3></div><span>Përsëritet çdo javë</span></div>
              <fieldset :disabled="saving" class="hours-week">
              <legend class="sr-only">Orari për çdo ditë të javës</legend>
              <article v-for="(day, dayIndex) in days" :id="`hours-day-${dayIndex + 1}`" :key="day" tabindex="-1" class="schedule-day" :class="{ 'schedule-day-open': dayIntervals(dayIndex + 1).length }">
                <div class="schedule-day-heading">
                  <USwitch :model-value="dayIntervals(dayIndex + 1).length > 0" :label="day" :disabled="saving || (!dayIntervals(dayIndex + 1).length && intervals.length >= 28)" @update:model-value="toggleDay(dayIndex + 1, $event)" />
                  <span :class="{ 'day-status-open': dayIntervals(dayIndex + 1).length, 'day-status-error': dayError(dayIndex + 1) }">{{ dayIntervals(dayIndex + 1).length ? (dayError(dayIndex + 1) ? 'Kontrollo orarin' : 'Ditë pune') : 'Pushim' }}</span>
                </div>
                <div v-if="dayIntervals(dayIndex + 1).length" class="schedule-day-content">
                  <div v-for="(interval, intervalIndex) in dayIntervals(dayIndex + 1)" :key="`${dayIndex}-${intervalIndex}`" class="shift-row">
                    <UFormField :label="`Nga${intervalIndex ? ' · intervali ' + (intervalIndex + 1) : ''}`"><UInput v-model="interval.start_time" type="time" required size="lg" class="w-full" :aria-label="`Fillimi për ${day}, intervali ${intervalIndex + 1}`" /></UFormField>
                    <span class="shift-separator" aria-hidden="true">—</span>
                    <UFormField label="Deri"><UInput v-model="interval.end_time" required pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00" placeholder="20:00" size="lg" class="w-full" :aria-label="`Përfundimi për ${day}, intervali ${intervalIndex + 1}`" /></UFormField>
                    <UButton type="button" color="neutral" variant="ghost" icon="i-lucide-x" class="shift-remove" :aria-label="`Hiq intervalin ${intervalIndex + 1} për ${day}`" @click="removeShift(interval)" />
                  </div>
                  <p v-if="dayError(dayIndex + 1)" class="hours-error" role="alert">{{ dayError(dayIndex + 1) }}</p>
                  <UButton type="button" color="primary" variant="link" size="sm" icon="i-lucide-plus" :disabled="!nextShift(dayIndex + 1)" @click="addShift(dayIndex + 1)">Shto interval</UButton>
                </div>
                <p v-else class="schedule-closed">Nuk pranohen rezervime këtë ditë.</p>
              </article>
              </fieldset>
            </div>
            <aside class="hours-guide">
              <div class="hours-guide-intro"><span class="hours-guide-icon"><UIcon name="i-lucide-coffee" class="size-5" /></span><h3>Lër vend për pauzën.</h3><p>Shto një interval të dytë. Koha ndërmjet intervaleve nuk shfaqet për rezervim.</p><div class="hours-pause-example" aria-label="Shembull orari me pauzë"><span>09:00–13:00</span><span class="pause-gap">Pauzë</span><span>14:00–20:00</span></div></div>
              <div class="hours-guide-exception"><strong>Një ditë jashtë rutinës?</strong><p>Për pushime në një datë të caktuar, blloko atë ditë pa ndryshuar javën.</p><NuxtLink to="/dashboard/blocked-times">Oraret e bllokuara <UIcon name="i-lucide-arrow-up-right" class="size-4" /></NuxtLink></div>
              <p class="hours-timezone"><UIcon name="i-lucide-globe-2" class="size-4 shrink-0" /><span>Zona kohore<strong>{{ data.settings.timezone || 'E pakonfiguruar' }}</strong></span></p>
            </aside>
          </div>
        </form>
      </div>

      <div v-if="resource === 'blocked-times'" class="grid gap-4">
        <div class="blocks-heading"><div><p class="hours-kicker">Pushime & përjashtime</p><h2>Planifiko kohën e lirë.</h2><p>Blloko një interval për një berber ose mbylle lokalin për gjithë ekipin.</p></div><UButton icon="i-lucide-plus" size="xl" :disabled="saving || !data.settings.timezone || !data.barbers.length" @click="reset">Shto bllokim</UButton></div>
        <div class="blocks-notice"><UIcon name="i-lucide-calendar-off" class="size-5 shrink-0 text-primary" /><p>Vetëm për datat që zgjedh.<span>Orari javor mbetet i pandryshuar; koha e bllokuar nuk ofrohet për rezervime.</span></p></div>
        <UModal :open="!!deleting" title="Ta hiqni këtë bllokim?" description="Ky veprim e bën intervalin sërish të disponueshëm, sipas orarit të punës së berberit." :dismissible="!saving" @update:open="updateDeleteModal"><template #body><p v-if="deleting" class="text-sm text-muted">{{ data.barbers.find(b => b.id === deleting?.barber_id)?.name }} · {{ deleting.reason || 'Orar i bllokuar' }}</p><UAlert v-if="message" class="mt-4" color="error" :description="message" /></template><template #footer><div class="flex w-full justify-end gap-3"><UButton color="neutral" variant="ghost" :disabled="saving" @click="deleting = null">Mbaje bllokimin</UButton><UButton color="error" :loading="saving" :disabled="saving" @click="removeBlock">Hiq bllokimin</UButton></div></template></UModal>
        <CommonEmptyState v-if="!data.blocks.length" title="Java vazhdon sipas planit" description="Nuk ka bllokime. Shto një pushim për një berber ose për të gjithë ekipin." />
        <div v-else class="blocks-list"><article v-for="block in data.blocks" :key="block.id" class="block-entry"><div class="block-date" aria-hidden="true"><UIcon name="i-lucide-calendar-x-2" class="size-5" /><strong>{{ blockDay(block.starts_at) }}</strong></div><div class="block-copy"><h3>{{ block.reason || 'Orar i bllokuar' }}</h3><p class="block-barber"><UIcon name="i-lucide-user-round" class="size-3.5" />{{ data.barbers.find(b => b.id === block.barber_id)?.name }}</p><p class="block-range"><span>{{ blockLabel(block.starts_at) }}</span><UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0" /><span>{{ blockLabel(block.ends_at) }}</span></p></div><div class="block-actions"><UButton size="sm" variant="outline" color="neutral" icon="i-lucide-pencil" :disabled="saving" :aria-label="`Ndrysho bllokimin për ${data.barbers.find(b => b.id === block.barber_id)?.name}`" @click="editBlock(block)">Ndrysho</UButton><UButton variant="ghost" color="error" icon="i-lucide-trash-2" :disabled="saving" aria-label="Hiq bllokimin" @click="message = ''; deleting = block" /></div></article></div>
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
          <fieldset :disabled="saving" class="rounded-xl border border-default bg-elevated/50 p-4 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="text-lg font-semibold">Çmimi sipas orarit</h2><p class="mt-1 max-w-xl text-sm leading-6 text-muted">Cakto një interval ditor kur shërbimet kanë çmim më të lartë. Çmimi llogaritet sipas orës së fillimit të terminit.</p></div><USwitch v-model="settings.peak_pricing_enabled" label="Aktivizo çmimin e rritur" /></div>
            <div class="mt-5 grid gap-4 sm:grid-cols-3">
              <UFormField label="Nga ora"><UInput v-model="settings.peak_start_time" type="time" required class="w-full" /></UFormField>
              <UFormField label="Deri në ora"><UInput v-model="settings.peak_end_time" type="time" required class="w-full" /></UFormField>
              <UFormField label="Shumëzuesi i çmimit" help="1.5× = 50% më shtrenjtë"><UInput v-model.number="settings.peak_multiplier" type="number" required min="1.01" max="5" step="0.01" class="w-full" /></UFormField>
            </div>
            <p class="mt-4 rounded-lg border border-default bg-default p-3 text-sm leading-6">{{ settings.peak_pricing_enabled ? `Çdo ditë, ${settings.peak_start_time}–${settings.peak_end_time}: +${Math.round((Number(settings.peak_multiplier) - 1) * 100)}%. Një shërbim prej 10 € kushton ${(10 * Number(settings.peak_multiplier)).toFixed(2)} €.` : 'Çmimi i rritur është i çaktivizuar. Të gjitha oraret përdorin çmimet normale.' }}</p>
            <p class="mt-3 text-xs leading-5 text-muted">Ora e përfundimit nuk përfshihet. Çmimi rillogaritet kur ndryshohet ora ose shërbimi i një rezervimi; ndryshimi vetëm i të dhënave të klientit nuk e prek çmimin.</p>
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
.service-sort-help { display: flex; align-items: center; gap: .75rem; padding: 1rem; border: 1px solid var(--ui-border); border-radius: .8rem; font-size: .8rem; background: color-mix(in srgb, var(--ui-primary) 3%, var(--ui-bg)); }
.service-sort-help small { display: block; margin-top: .25rem; font-size: .7rem; color: var(--ui-text-muted); line-height: 1.6; }
.service-sort-card { position: relative; min-width: 0; border-radius: .8rem; cursor: grab; touch-action: none; user-select: none; }
.service-sort-card:active { cursor: grabbing; }
.service-sort-card:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
.service-sort-disabled { cursor: default; touch-action: auto; }
.service-sort-source { outline: 2px dashed var(--ui-primary); outline-offset: -2px; background: color-mix(in srgb, var(--ui-primary) 6%, var(--ui-bg)); }
.service-sort-source .service-sort-content { opacity: .08; }
.service-drop-slot { position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem; color: var(--ui-primary); }
.service-drop-slot strong { font-size: .9rem; font-weight: 650; }
.service-drop-slot span { font-size: .75rem; }
.service-position { color: var(--ui-text-dimmed); font-size: .75rem; font-variant-numeric: tabular-nums; }
.service-drag-preview { position: fixed; z-index: 60; pointer-events: none; display: flex; align-items: center; gap: .5rem; max-width: 13rem; padding: .75rem 1rem; border: 1px solid var(--ui-primary); border-radius: .6rem; background: var(--ui-bg); color: var(--ui-primary); box-shadow: 0 .75rem 2rem rgb(0 0 0 / .15); transform: translate(-50%, calc(-100% - 1rem)); font-size: .8rem; font-weight: 600; }
.control:disabled { opacity: .6; }
input[type=checkbox] { accent-color: var(--ui-primary); width: 1rem; height: 1rem; }
.hours-editor { --hours-line: color-mix(in srgb, var(--ui-border) 80%, transparent); }
.blocks-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: .75rem; }
.blocks-heading h2 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 600; letter-spacing: -.04em; margin-top: .6rem; }
.blocks-heading h2 + p { color: var(--ui-text-muted); font-size: .85rem; line-height: 1.7; margin-top: .6rem; max-width: 32rem; }
.blocks-heading > button { flex-shrink: 0; }
.blocks-notice { display: flex; align-items: center; gap: 1rem; padding: 1.2rem 1.4rem; border: 1px solid color-mix(in srgb, var(--ui-primary) 15%, var(--ui-border)); border-radius: .9rem; background: color-mix(in srgb, var(--ui-primary) 4%, var(--ui-bg)); }
.blocks-notice p { font-size: .85rem; font-weight: 550; }
.blocks-notice span { display: block; margin-top: .25rem; color: var(--ui-text-muted); font-size: .75rem; font-weight: 400; line-height: 1.6; }
.blocks-list { border: 1px solid var(--ui-border); border-radius: 1rem; overflow: hidden; background: var(--ui-bg); }
.block-entry { display: grid; grid-template-columns: 5rem minmax(0, 1fr) auto; align-items: center; gap: 1.25rem; padding: 1.4rem; }
.block-entry + .block-entry { border-top: 1px solid var(--ui-border); }
.block-date { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem; min-height: 5rem; background: color-mix(in srgb, var(--ui-primary) 5%, var(--ui-bg)); border: 1px solid color-mix(in srgb, var(--ui-primary) 12%, var(--ui-border)); border-radius: .75rem; color: var(--ui-primary); }
.block-date strong { font-size: .7rem; font-weight: 650; }
.block-copy h3 { font-size: 1rem; font-weight: 600; letter-spacing: -.02em; overflow-wrap: anywhere; white-space: pre-wrap; }
.block-barber { display: flex; align-items: center; gap: .35rem; color: var(--ui-primary); font-size: .75rem; margin-top: .5rem; }
.block-range { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; font-size: .75rem; color: var(--ui-text-muted); margin-top: .6rem; font-variant-numeric: tabular-nums; }
.block-actions { display: flex; align-items: center; gap: .35rem; }
@media (max-width: 639px) { .blocks-heading { flex-direction: column; align-items: stretch; gap: 1rem; } .blocks-heading > button { justify-content: center; } .blocks-notice { padding: 1rem; align-items: start; } .block-entry { grid-template-columns: 3.75rem minmax(0, 1fr); padding: 1rem; gap: .85rem; } .block-date { min-height: 4.5rem; } .block-actions { grid-column: 2; justify-content: flex-end; padding-top: .25rem; } }
.hours-heading { display: flex; justify-content: space-between; align-items: end; gap: 2rem; margin-bottom: 1.75rem; }
.hours-kicker { color: var(--ui-primary); font-size: .7rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.hours-heading h2 { margin-top: .6rem; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 650; letter-spacing: -.04em; line-height: 1.2; }
.hours-heading h2 + p { margin-top: .65rem; font-size: .875rem; line-height: 1.6; color: var(--ui-text-muted); }
.hours-barber { width: 15rem; flex-shrink: 0; }
.hours-overview { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 1.5rem 1.75rem; margin-bottom: 1.75rem; border: 1px solid color-mix(in srgb, var(--ui-primary) 15%, var(--ui-border)); border-radius: 1rem; background: linear-gradient(115deg, color-mix(in srgb, var(--ui-primary) 7%, var(--ui-bg)), var(--ui-bg)); }
.hours-day-count { flex-shrink: 0; display: flex; flex-direction: column; gap: .15rem; }
.hours-day-count strong { font-size: 2.25rem; font-weight: 600; letter-spacing: -.06em; line-height: 1.15; font-variant-numeric: tabular-nums; }
.hours-day-count small { margin-left: .5rem; font-size: 1rem; font-weight: 400; color: var(--ui-text-dimmed); letter-spacing: 0; }
.hours-day-count > span { color: var(--ui-text-muted); font-size: .75rem; }
.hours-week-preview { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .5rem; width: min(100%, 29rem); }
.hours-week-preview a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem; min-height: 4rem; padding: .65rem .3rem; border: 1px solid var(--hours-line); border-radius: .65rem; background: var(--ui-bg); color: var(--ui-text-dimmed); font-size: .7rem; transition: border-color .2s, transform .2s; }
.hours-week-preview .preview-day-open { border-color: color-mix(in srgb, var(--ui-primary) 22%, var(--ui-border)); color: var(--ui-primary); background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg)); font-weight: 600; }
.hours-week-preview .preview-day-error { color: var(--ui-error); border-color: var(--ui-error); }
.hours-week-preview a:hover { transform: translateY(-2px); border-color: var(--ui-primary); }
.hours-week-preview a:focus-visible, .schedule-day:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.hours-layout { display: grid; gap: 1.5rem; align-items: start; }
.hours-week-panel { min-width: 0; border: 1px solid var(--hours-line); border-radius: 1rem; overflow: hidden; background: var(--ui-bg); box-shadow: 0 .25rem 1.5rem rgb(30 45 38 / .025); }
.hours-week-title { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem; border-bottom: 1px solid var(--hours-line); }
.hours-week-title > div { display: flex; align-items: center; gap: .65rem; }
.hours-week-title h3 { font-size: .9rem; font-weight: 650; }
.hours-week-title > span { font-size: .65rem; color: var(--ui-text-muted); }
.hours-week { min-width: 0; }
.schedule-day { display: grid; gap: .75rem; padding: 1.25rem; background: color-mix(in srgb, var(--ui-bg-elevated) 35%, var(--ui-bg)); }
.schedule-day + .schedule-day { border-top: 1px solid var(--hours-line); }
.schedule-day-open { background: var(--ui-bg); }
.schedule-day { scroll-margin-top: 6rem; }
.schedule-day-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.schedule-day-heading > span { font-size: .7rem; color: var(--ui-text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.schedule-day-heading > span.day-status-open { color: var(--ui-primary); }
.schedule-day-heading > span.day-status-error { color: var(--ui-error); }
.schedule-day-content { display: grid; gap: .75rem; min-width: 0; }
.schedule-day-content > button { justify-self: start; padding-left: 0; }
.shift-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; gap: .65rem; align-items: end; }
.shift-separator { padding-bottom: .7rem; color: var(--ui-text-dimmed); }
.shift-remove { min-width: 2.5rem; min-height: 2.5rem; margin-bottom: .05rem; }
.schedule-closed { color: var(--ui-text-dimmed); font-size: .75rem; padding-left: 3rem; }
.hours-error { color: var(--ui-error); font-size: .75rem; line-height: 1.5; }
.hours-guide { border: 1px solid var(--hours-line); border-radius: 1rem; overflow: hidden; background: color-mix(in srgb, var(--ui-bg-elevated) 25%, var(--ui-bg)); }
.hours-guide-icon { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 1px solid color-mix(in srgb, var(--ui-primary) 15%, var(--ui-border)); border-radius: .7rem; color: var(--ui-primary); background: var(--ui-bg); }
.hours-guide h3 { margin: 1rem 0 .6rem; max-width: 10rem; font-size: 1.25rem; font-weight: 600; letter-spacing: -.04em; line-height: 1.25; }
.hours-guide p { font-size: .8rem; color: var(--ui-text-muted); line-height: 1.8; }
.hours-guide-intro { padding: 1.4rem; background: color-mix(in srgb, var(--ui-primary) 3%, var(--ui-bg)); }
.hours-guide-exception { padding: 1.4rem; border-top: 1px solid var(--hours-line); }
.hours-pause-example { display: grid; margin-top: 1.25rem; gap: .25rem; font-size: .7rem; font-variant-numeric: tabular-nums; }
.hours-pause-example > span { border-left: 2px solid color-mix(in srgb, var(--ui-primary) 55%, transparent); padding: .55rem .75rem; background: color-mix(in srgb, var(--ui-primary) 7%, var(--ui-bg)); color: var(--ui-primary); border-radius: 0 .35rem .35rem 0; }
.hours-pause-example > span.pause-gap { border-left: 2px dashed var(--ui-border); background: transparent; color: var(--ui-text-dimmed); padding-block: .35rem; font-size: .65rem; }
.hours-guide .hours-timezone { display: flex; gap: .65rem; align-items: center; margin: 0 1.4rem; padding: 1rem 0; border-top: 1px solid var(--hours-line); font-size: .65rem; line-height: 1.5; }
.hours-guide .hours-timezone strong { margin: .2rem 0 0; font-size: .7rem; color: var(--ui-text-muted); font-weight: 500; overflow-wrap: anywhere; }
.hours-guide strong { display: block; margin-bottom: .4rem; font-size: .8rem; font-weight: 600; }
.hours-guide a { display: inline-flex; align-items: center; gap: .3rem; margin-top: .75rem; color: var(--ui-primary); font-size: .75rem; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.hours-savebar { position: sticky; top: .75rem; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem 1.25rem; border: 1px solid color-mix(in srgb, var(--ui-primary) 35%, var(--ui-border)); border-radius: .8rem; background: var(--ui-bg); box-shadow: 0 .5rem 2rem rgb(30 45 38 / .15), inset 3px 0 var(--ui-primary); }
.hours-save-message { display: flex; align-items: center; gap: .75rem; min-width: 0; color: var(--ui-primary); }
.hours-save-message strong { display: block; font-size: .85rem; font-weight: 650; color: var(--ui-text); }
.hours-save-message small { display: block; margin-top: .25rem; color: var(--ui-text-muted); font-size: .75rem; line-height: 1.5; }
.hours-save-actions { display: flex; gap: .5rem; flex-shrink: 0; }
@media (min-width: 768px) { .hours-layout { grid-template-columns: minmax(0, 1fr) 15rem; } .hours-guide { position: sticky; top: 6rem; } }
@media (min-width: 1280px) { .schedule-day { grid-template-columns: 9rem minmax(0, 1fr); gap: 1.25rem; } .schedule-day-heading { align-items: start; flex-direction: column; justify-content: start; padding-top: 1.6rem; gap: .45rem; } .schedule-day-heading > span { padding-left: 3rem; } .schedule-closed { padding: 1.6rem 0; } }
@media (max-width: 639px) { .hours-heading { flex-direction: column; align-items: stretch; gap: 1.25rem; } .hours-barber { width: 100%; } .hours-overview { flex-direction: column; align-items: stretch; gap: 1.25rem; padding: 1.25rem; } .hours-day-count { flex-direction: row; align-items: baseline; gap: .75rem; } .hours-week-preview { width: 100%; gap: .35rem; } .hours-week-preview a { min-height: 3.6rem; } .hours-week-title { padding: 1rem; } .schedule-day { padding: 1rem; } .shift-row { gap: .45rem; } .hours-guide h3 { max-width: none; } .hours-savebar { flex-wrap: wrap; bottom: .75rem; padding: .85rem; } .hours-savebar > div { width: 100%; } .hours-savebar > div > :last-child { flex: 1; justify-content: center; } }
@media (prefers-reduced-motion: reduce) { .hours-week-preview a { transition: none; } .hours-week-preview a:hover { transform: none; } }
@media (max-width: 639px) { .hours-savebar { top: .5rem; bottom: auto; } .schedule-day { scroll-margin-top: 11rem; } }
</style>
