<script setup lang="ts">
import type { AppointmentRecord, AppointmentStatus } from '#shared/types/appointments'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Terminet | Toli Hair', robots: 'noindex, nofollow' })
const route = useRoute()
const toast = useToast()
const today = localDateInZone()
const defaultTo = shiftDate(today, 30)
const draft = reactive({ from: today, to: defaultTo, barberId: '', query: '' })
const applied = reactive({ ...draft })
const apiQuery = computed(() => ({ ...applied, to: shiftDate(applied.to, 1), status: 'confirmed' }))
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-list', query: apiQuery })
const data = computed(() => request.data.value)
const now = ref(Date.now())
const nextAppointment = computed(() => data.value?.appointments
  .filter(item => item.status === 'confirmed' && new Date(item.starts_at).getTime() > now.value)
  .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime())[0])
const activeFilterCount = computed(() => [
  applied.from !== today || applied.to !== defaultTo,
  Boolean(applied.barberId),
  Boolean(applied.query),
].filter(Boolean).length)
const editor = ref<AppointmentRecord | null | 'new'>(route.query.new === '1' ? 'new' : null)
const editorSaving = ref(false)
const editorOpen = computed({
  get: () => editor.value !== null,
  set: value => { if (!value && !editorSaving.value) editor.value = null },
})
watch(editor, () => { editorSaving.value = false }, { flush: 'sync' })
const pending = ref('')
const cancellation = ref<AppointmentRecord | null>(null)
const cancelling = ref(false)
const cancellationError = ref('')
const cancellationOpen = computed({
  get: () => cancellation.value !== null,
  set: value => { if (!value && !cancelling.value) cancellation.value = null },
})
const message = ref('')
const filtersOpen = ref(false)
const autoRefreshing = ref(false)
const autoRefreshInterval = 30_000
let autoRefreshTimer: ReturnType<typeof setInterval> | undefined
let refreshController: AbortController | undefined
watch(apiQuery, () => refreshController?.abort(), { flush: 'sync' })
watch(() => request.status.value, status => { if (status === 'pending') refreshController?.abort() }, { flush: 'sync' })

function applyFilters() { Object.assign(applied, draft); editor.value = null; filtersOpen.value = false }
function clearFilters() { Object.assign(draft, { from: today, to: defaultTo, barberId: '', query: '' }); applyFilters() }
function barberName(id: string) { return data.value?.barbers.find(item => item.id === id)?.name || 'Berber i panjohur' }
function money(value: number) { return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(value / 100) }
function appointmentDate(value: string) {
  const timezone = data.value?.timezone || 'Europe/Belgrade'
  const appointmentDay = appointmentLocalDate(value, timezone)
  const currentDay = localDateInZone(timezone)
  if (appointmentDay === currentDay) return 'Sot'
  if (appointmentDay === shiftDate(currentDay, 1)) return 'Nesër'

  const difference = Math.round((Date.parse(`${appointmentDay}T12:00:00Z`) - Date.parse(`${currentDay}T12:00:00Z`)) / 86_400_000)
  const localCalendarDate = new Date(`${appointmentDay}T12:00:00Z`)
  if (difference >= 2 && difference <= 6) {
    return ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'][localCalendarDate.getUTCDay()]
  }
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(localCalendarDate)
}
function canEdit(item: AppointmentRecord) { return item.status === 'confirmed' && new Date(item.starts_at).getTime() > Date.now() }
function hasStarted(item: AppointmentRecord) { return new Date(item.starts_at).getTime() <= Date.now() }
async function saved() { editor.value = null; await request.refresh(); message.value = 'Termini u ruajt me sukses.' }

async function refreshAutomatically() {
  now.value = Date.now()
  if (autoRefreshing.value || cancelling.value || request.status.value === 'pending' || document.visibilityState !== 'visible') return
  if (!data.value) { await request.refresh(); return }
  const knownIds = new Set(data.value.appointments.map(item => item.id))
  const query = { ...apiQuery.value }
  const controller = new AbortController()
  refreshController = controller
  autoRefreshing.value = true
  try {
    const updated = await $fetch('/api/dashboard/appointments', { query, signal: controller.signal, timeout: 15_000 })
    if (controller.signal.aborted || JSON.stringify(query) !== JSON.stringify(apiQuery.value)) return
    request.data.value = updated
    const newAppointments = data.value?.appointments.filter(item => !knownIds.has(item.id)) ?? []
    if (newAppointments.length) {
      const first = newAppointments[0]
      toast.add({
        title: newAppointments.length === 1 ? 'Rezervim i ri' : `${newAppointments.length} rezervime të reja`,
        description: newAppointments.length === 1 && first
          ? `${first.customer_name} · ${appointmentDateTime(first.starts_at, data.value?.timezone || 'Europe/Belgrade')}`
          : 'Lista e termineve u përditësua automatikisht.',
        icon: 'i-lucide-calendar-check',
        color: 'success',
      })
    }
  }
  catch {
    // Preserve the visible list during temporary network failures; retry next cycle.
  }
  finally {
    autoRefreshing.value = false
  }
}

function refreshWhenVisible() {
  if (document.visibilityState === 'visible') void refreshAutomatically()
}

onMounted(() => {
  autoRefreshTimer = setInterval(() => void refreshAutomatically(), autoRefreshInterval)
  window.addEventListener('focus', refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)
})

onBeforeUnmount(() => {
  refreshController?.abort()
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
})

function askCancellation(item: AppointmentRecord) {
  cancellationError.value = ''
  pending.value = ''
  cancellation.value = item
}

async function confirmCancellation() {
  const item = cancellation.value
  if (!item || cancelling.value) return
  cancelling.value = true
  cancellationError.value = ''
  refreshController?.abort()
  try {
    await $fetch('/api/dashboard/appointments', {
      method: 'POST', headers: { 'x-toli-request': '1' }, timeout: 20_000,
      body: { action: 'status', id: item.id, version: item.version, status: 'cancelled' },
    })
  }
  catch (error: unknown) {
    cancellationError.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'Rezervimi nuk mund të anulohej. Provoni përsëri.'
    return
  }
  finally { cancelling.value = false }
  cancellation.value = null
  message.value = 'Rezervimi u anulua me sukses.'
  await request.refresh()
}

async function changeStatus(item: AppointmentRecord, status: Exclude<AppointmentStatus, 'confirmed' | 'cancelled'>) {
  const key = `${item.id}:${status}`
  if (pending.value !== key) { pending.value = key; return }
  message.value = ''
  try {
    await $fetch('/api/dashboard/appointments', { method: 'POST', headers: { 'x-toli-request': '1' }, body: { action: 'status', id: item.id, version: item.version, status } })
    pending.value = ''; await request.refresh(); message.value = 'Statusi i terminit u përditësua.'
  }
  catch (error: unknown) {
    pending.value = ''
    message.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'Statusi nuk mund të ndryshohej.'
  }
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div><h1 class="sr-only">Terminet</h1><p class="text-sm text-muted">Rezervimet që presin për t’u realizuar. Kërko klientin dhe menaxho terminin.</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <UPopover v-model:open="filtersOpen" :content="{ align: 'end', side: 'bottom', sideOffset: 8 }">
          <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-list-filter">
            Filtro
            <UBadge v-if="activeFilterCount" color="primary" variant="solid" size="sm">{{ activeFilterCount }}</UBadge>
          </UButton>
          <template #content>
            <form class="filter-panel" @submit.prevent="applyFilters">
              <div class="mb-4 flex items-start justify-between gap-4"><div><h2 class="font-semibold">Filtro terminet</h2><p class="mt-1 text-xs text-muted">Kufizo listën sipas datës, berberit ose klientit.</p></div><UButton type="button" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Mbyll filtrat" @click="filtersOpen = false" /></div>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Nga"><UInput v-model="draft.from" type="date" required class="w-full" :max="draft.to" /></UFormField>
                <UFormField label="Deri"><UInput v-model="draft.to" type="date" required class="w-full" :min="draft.from" /></UFormField>
                <UFormField label="Berberi" class="sm:col-span-2"><USelect :model-value="draft.barberId || 'all'" :items="[{ label: 'Të gjithë berberët', value: 'all' }, ...(data?.barbers || []).map(item => ({ label: item.name, value: item.id }))]" class="w-full" @update:model-value="draft.barberId = $event === 'all' ? '' : $event" /></UFormField>
                <UFormField label="Kërko klientin" class="sm:col-span-2"><UInput v-model="draft.query" maxlength="100" class="w-full" placeholder="Emër, telefon ose email" /></UFormField>
              </div>
              <div class="mt-5 flex items-center justify-between gap-3 border-t border-default pt-4"><UButton type="button" color="neutral" variant="ghost" @click="clearFilters">Pastro</UButton><UButton type="submit" icon="i-lucide-check">Zbato filtrat</UButton></div>
            </form>
          </template>
        </UPopover>
        <UButton size="lg" icon="i-lucide-plus" @click="editor = 'new'">Shto termin</UButton>
      </div>
    </div>
    <div class="mt-5 flex items-center gap-2 text-xs text-muted"><span class="live-dot text-success" aria-hidden="true" /><span>Përditësim automatik në sfond</span></div>
    <p v-if="message" role="status" class="mt-5 rounded-md bg-elevated p-4 text-sm">{{ message }}</p>
    <p v-if="request.status.value === 'pending' && !data" role="status" class="mt-8">Po ngarkohen terminet…</p>
    <UAlert v-else-if="request.error.value && !data" class="mt-8" color="error" title="Terminet nuk mund të ngarkoheshin" description="Provoni përsëri pas pak." />
    <CommonEmptyState v-else-if="!data?.appointments.length" class="mt-8" title="Nuk u gjet asnjë termin" description="Ndryshoni filtrat ose krijoni një termin të ri manualisht." />
    <template v-else>
      <article v-if="nextAppointment" class="next-appointment" aria-labelledby="next-title">
        <div class="next-topline">
          <h2 id="next-title"><UIcon name="i-lucide-calendar-check-2" class="size-4" /> Termini i radhës</h2>
          <div class="next-time"><strong>{{ appointmentTime(nextAppointment.starts_at, data!.timezone) }}</strong><span>{{ appointmentDate(nextAppointment.starts_at) }}</span></div>
        </div>
        <div class="next-content">
          <div class="next-client"><p class="next-label">Klienti</p><h3>{{ nextAppointment.customer_name }}</h3></div>
          <dl class="next-meta">
            <div><dt><UIcon name="i-lucide-scissors" class="size-3.5" /> Shërbimi</dt><dd>{{ nextAppointment.service_name }}<small>{{ nextAppointment.duration_minutes }} minuta</small></dd></div>
            <div><dt><UIcon name="i-lucide-user-round" class="size-3.5" /> Berberi</dt><dd>{{ barberName(nextAppointment.barber_id) }}</dd></div>
          </dl>
        </div>
        <footer class="next-footer">
          <a :href="`tel:${nextAppointment.customer_phone.replace(/[^\d+]/g, '')}`" class="next-phone"><UIcon name="i-lucide-phone" class="size-4 shrink-0" /><span>{{ nextAppointment.customer_phone }}</span></a>
          <UButton color="primary" variant="outline" size="sm" icon="i-lucide-pencil" class="next-edit" @click="editor = nextAppointment">Ndrysho</UButton>
        </footer>
      </article>

      <div class="appointments-heading"><div><h2>Terminet për t’u realizuar</h2><p>{{ data!.appointments.length }} rezultate në periudhën e zgjedhur</p></div><UBadge v-if="activeFilterCount" color="primary" variant="subtle">{{ activeFilterCount }} {{ activeFilterCount === 1 ? 'filtër aktiv' : 'filtra aktivë' }}</UBadge></div>
      <div class="appointment-list">
      <div class="list-columns" aria-hidden="true"><span>Ora / Data</span><span>Klienti</span><span>Shërbimi / Berberi</span><span /></div>
      <UCollapsible v-for="item in data.appointments" :key="item.id" class="appointment-card">
        <UButton color="neutral" variant="ghost" class="appointment-summary w-full text-left">
          <span class="compact-client">
            <span class="customer-name">{{ item.customer_name }}</span>
            <span class="compact-phone"><UIcon name="i-lucide-phone" />{{ item.customer_phone }}</span>
          </span>
          <span class="compact-service"><strong>{{ item.service_name }}</strong><span>{{ barberName(item.barber_id) }}<span class="service-duration"> · {{ item.duration_minutes }} min</span></span></span>
          <span class="compact-duration"><UIcon name="i-lucide-clock-3" aria-hidden="true" />{{ item.duration_minutes }} min</span>
          <span class="compact-time"><strong>{{ appointmentTime(item.starts_at, data.timezone) }}</strong><span>{{ appointmentDate(item.starts_at) }}</span></span>
          <UIcon name="i-lucide-chevron-down" class="expand-icon" aria-hidden="true" />
          <span class="sr-only">Hollësitë e rezervimit</span>
        </UButton>
        <template #content>

        <div class="appointment-details">
          <div class="appointment-detail appointment-detail-primary">
            <span class="detail-icon"><UIcon name="i-lucide-calendar-days" /></span>
            <div><p class="card-label">Data</p><strong :title="appointmentDateTime(item.starts_at, data.timezone)">{{ appointmentDate(item.starts_at) }}</strong><span><UIcon name="i-lucide-clock-3" /> {{ appointmentTime(item.starts_at, data.timezone) }} · {{ item.duration_minutes }} minuta</span></div>
          </div>
          <div class="appointment-detail">
            <span class="detail-icon"><UIcon name="i-lucide-scissors" /></span>
            <div><p class="card-label">Shërbimi</p><strong>{{ item.service_name }}</strong><span>{{ money(item.price_minor) }}</span></div>
          </div>
          <div class="appointment-detail">
            <span class="detail-icon"><UIcon name="i-lucide-user-round" /></span>
            <div><p class="card-label">Berberi</p><strong>{{ barberName(item.barber_id) }}</strong></div>
          </div>
        </div>

        <dl class="expanded-contact">
          <div><dt>Telefoni</dt><dd><a :href="`tel:${item.customer_phone.replace(/[^\d+]/g, '')}`">{{ item.customer_phone }}</a></dd></div>
          <div v-if="item.customer_email"><dt>Emaili</dt><dd><a :href="`mailto:${item.customer_email}`">{{ item.customer_email }}</a></dd></div>
          <div><dt>Burimi</dt><dd>{{ item.source === 'online' ? 'Rezervim online' : 'Shtuar nga stafi' }}</dd></div>
        </dl>

        <footer v-if="item.status === 'confirmed'" class="appointment-actions">
          <p>{{ hasStarted(item) ? 'Përditëso rezultatin e këtij termini' : 'Menaxho rezervimin' }}</p>
          <div>
            <UButton v-if="canEdit(item)" size="sm" color="neutral" variant="outline" icon="i-lucide-pencil" @click="editor = item">Ndrysho</UButton>
            <UButton v-if="hasStarted(item)" size="sm" color="success" variant="outline" @click="changeStatus(item, 'completed')">{{ pending === `${item.id}:completed` ? 'Konfirmo përfundimin' : 'Përfundo' }}</UButton>
            <UButton v-if="hasStarted(item)" size="sm" color="warning" variant="outline" @click="changeStatus(item, 'no_show')">{{ pending === `${item.id}:no_show` ? 'Konfirmo mungesën' : 'Nuk u paraqit' }}</UButton>
            <UButton size="sm" color="error" variant="outline" @click="askCancellation(item)">Anulo</UButton>
          </div>
        </footer>
        </template>
      </UCollapsible>
      </div>
    </template>
    <UModal
      v-model:open="editorOpen"
      :title="editor === 'new' ? 'Shto termin' : 'Ndrysho termin'"
      :description="editor && editor !== 'new' ? `Përditëso rezervimin për ${editor.customer_name}.` : 'Zgjidh shërbimin, orarin dhe të dhënat e klientit.'"
      scrollable
      :dismissible="!editorSaving"
      :close="!editorSaving"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <DashboardAppointmentForm
          v-if="editor && data"
          :key="editor === 'new' ? 'new' : editor.id"
          :data="data"
          :appointment="editor === 'new' ? null : editor"
          embedded
          @saving-change="editorSaving = $event"
          @saved="saved"
          @cancel="editorOpen = false"
        />
        <p v-else-if="request.error.value" role="alert" class="text-sm text-error">Të dhënat nuk mund të ngarkoheshin. Mbyll formularin dhe provo përsëri.</p>
        <p v-else role="status" class="py-8 text-center text-sm text-muted">Po ngarkohet formulari…</p>
      </template>
    </UModal>
    <UModal
      v-model:open="cancellationOpen"
      title="Anulo rezervimin"
      description="A jeni i sigurt që dëshironi ta anuloni këtë rezervim?"
      :dismissible="!cancelling"
      :close="!cancelling"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div v-if="cancellation" class="cancellation-summary">
          <strong>{{ cancellation.customer_name }}</strong>
          <span><UIcon name="i-lucide-calendar-days" class="size-4 shrink-0" />{{ appointmentDateTime(cancellation.starts_at, data?.timezone) }}</span>
          <span><UIcon name="i-lucide-scissors" class="size-4 shrink-0" />{{ cancellation.service_name }} · {{ barberName(cancellation.barber_id) }}</span>
        </div>
        <p class="mt-4 text-sm leading-6 text-muted">Rezervimi do të shënohet si i anuluar dhe do të ruhet në historik.</p>
        <UAlert v-if="cancellationError" color="error" icon="i-lucide-circle-alert" :title="cancellationError" class="mt-4" />
      </template>
      <template #footer>
        <div class="cancellation-actions">
          <UButton color="neutral" variant="outline" size="lg" :disabled="cancelling" @click="cancellationOpen = false">Jo, kthehu</UButton>
          <UButton color="error" size="lg" :loading="cancelling" :disabled="cancelling" @click="confirmCancellation">Po, anulo rezervimin</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.cancellation-summary { display:grid; gap:.75rem; padding:1rem; border:1px solid var(--ui-border); border-radius:.75rem; background:var(--ui-bg-elevated); }
.cancellation-summary > strong { font-size:1rem; font-weight:600; overflow-wrap:anywhere; }
.cancellation-summary > span { display:flex; align-items:flex-start; gap:.5rem; color:var(--ui-text-muted); font-size:.8rem; line-height:1.6; overflow-wrap:anywhere; }
.cancellation-actions { display:flex; flex-wrap:wrap; gap:.75rem; justify-content:space-between; width:100%; }
@media(max-width:479px) { .cancellation-actions { flex-direction:column-reverse; } .cancellation-actions > * { width:100%; justify-content:center; } }
.field { display:flex; flex-direction:column; gap:.45rem; font-size:.8rem; font-weight:600; }
.filter-panel { width:min(30rem,calc(100vw - 2rem)); max-height:80svh; overflow:auto; padding:1.25rem; }
.live-dot { width:.4rem; height:.4rem; flex-shrink:0; border-radius:50%; background:currentColor; }
.next-appointment { margin-top:1.5rem; border:1px solid color-mix(in srgb,var(--ui-primary) 22%,var(--ui-border)); border-radius:.9rem; background:var(--ui-bg); overflow:hidden; box-shadow:0 4px 16px rgb(18 36 29 / .035); }
.next-topline { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 1.4rem; border-bottom:1px solid color-mix(in srgb,var(--ui-primary) 12%,var(--ui-border)); background:color-mix(in srgb,var(--ui-primary) 6%,var(--ui-bg)); }
.next-topline h2 { display:flex; align-items:center; gap:.5rem; color:var(--ui-primary); font-size:.75rem; font-weight:650; }
.next-time { display:flex; align-items:center; gap:.7rem; flex-shrink:0; }
.next-time strong { font-size:1.8rem; line-height:1; font-weight:600; letter-spacing:-.04em; font-variant-numeric:tabular-nums; color:var(--ui-text-highlighted); }
.next-time span { color:var(--ui-text-muted); font-size:.75rem; }
.next-content { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:start; gap:1.5rem; padding:1.3rem 1.4rem; }
.next-label { margin-bottom:.45rem; color:var(--ui-text-muted); font-size:.68rem; }
.next-client h3 { color:var(--ui-text-highlighted); font-size:1.15rem; line-height:1.4; letter-spacing:-.025em; font-weight:650; overflow-wrap:anywhere; }
.next-meta { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:1rem; }
.next-meta > div { min-width:0; }
.next-meta dt { display:flex; align-items:center; gap:.35rem; color:var(--ui-text-muted); font-size:.68rem; }
.next-meta dd { margin-top:.45rem; font-size:.82rem; font-weight:550; line-height:1.5; overflow-wrap:anywhere; }
.next-meta small { display:block; margin-top:.2rem; color:var(--ui-text-muted); font-size:.7rem; font-weight:400; }
.next-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.8rem; margin-inline:1.4rem; padding-block:.9rem; border-top:1px solid var(--ui-border); }
.next-phone { display:flex; align-items:center; gap:.5rem; min-width:0; color:var(--ui-text-muted); font-size:.8rem; font-variant-numeric:tabular-nums; }
.next-phone > span { overflow-wrap:anywhere; }
.next-phone:hover { color:var(--ui-primary); }
.next-phone:focus-visible { outline:2px solid var(--ui-primary); outline-offset:4px; border-radius:3px; }
.next-edit { min-height:2.35rem; padding-inline:.9rem; }
.appointments-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:2rem 0 1rem; }
.appointments-heading h2 { font-size:.95rem; font-weight:700; }
.appointments-heading p { margin-top:.2rem; color:var(--ui-text-muted); font-size:.75rem; }
.appointment-list { --list-grid:6rem minmax(0,1.2fr) minmax(0,1fr) 1rem; border:1px solid var(--ui-border); border-radius:.45rem; overflow:hidden; }
.list-columns { display:grid; grid-template-columns:var(--list-grid); align-items:center; gap:1.25rem; padding:.8rem 1.25rem; background:var(--ui-bg-elevated); color:var(--ui-text-muted); font-size:.68rem; font-weight:550; }
.appointment-card { min-width:0; border-top:1px solid var(--ui-border); background:var(--ui-bg); overflow:hidden; }
.appointment-summary { display:grid; grid-template-columns:var(--list-grid); align-items:center; gap:1.25rem; padding:1.1rem 1.25rem; border-radius:0; cursor:pointer; list-style:none; }
.appointment-card[data-state="open"] .appointment-summary { background:color-mix(in srgb,var(--ui-primary) 5%,var(--ui-bg)); box-shadow:inset 3px 0 var(--ui-primary); }
.appointment-summary::-webkit-details-marker { display:none; }
.appointment-summary:hover { background:var(--ui-bg-elevated); }
.appointment-summary:focus-visible { outline:2px solid var(--ui-primary); outline-offset:-3px; border-radius:.6rem; }
.compact-client { display:block; min-width:0; grid-column:2; grid-row:1; }
.customer-name { display:block; color:var(--ui-text-highlighted); font-size:.9rem; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.compact-service { grid-column:3; grid-row:1; min-width:0; }
.compact-service strong { display:block; color:var(--ui-text-highlighted); font-size:.82rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.compact-service > span { display:block; margin-top:.35rem; color:var(--ui-text-muted); font-size:.7rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.compact-duration { display:none; }
.compact-phone { display:flex; align-items:center; gap:.35rem; margin-top:.2rem; font-size:.75rem; color:var(--ui-text-muted); }
.compact-phone svg { width:.8rem; height:.8rem; flex-shrink:0; }
.compact-time { text-align:left; grid-column:1; grid-row:1; }
.compact-time strong { display:block; color:var(--ui-text-highlighted); font-size:.95rem; font-weight:600; font-variant-numeric:tabular-nums; }
.compact-time > span { display:block; margin-top:.25rem; font-size:.7rem; color:var(--ui-text-muted); }
.expand-icon { grid-column:4; grid-row:1; width:1rem; height:1rem; color:var(--ui-text-muted); transition:transform .15s; }
.appointment-card[data-state="open"] .expand-icon { transform:rotate(180deg); }
.appointment-details { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1.5rem; border-top:1px solid var(--ui-border); background:var(--ui-bg); padding:1.5rem 1.25rem; }
.appointment-detail { display:flex; align-items:flex-start; gap:.6rem; min-width:0; }
.appointment-detail > div { min-width:0; }
.detail-icon { display:grid; place-items:center; color:var(--ui-primary); padding-top:.15rem; flex-shrink:0; }
.detail-icon svg { width:1rem; height:1rem; }
.card-label,.expanded-contact dt { color:var(--ui-text-muted); font-size:.7rem; }
.appointment-detail strong { display:block; margin-top:.25rem; font-size:.8rem; font-weight:600; overflow-wrap:anywhere; }
.appointment-detail div > span { display:block; margin-top:.25rem; color:var(--ui-text-muted); font-size:.75rem; }
.appointment-detail div > span svg { display:inline-block; vertical-align:middle; width:.8rem; height:.8rem; }
.expanded-contact { display:flex; flex-wrap:wrap; gap:.75rem 2rem; padding:1rem 1.25rem; border-top:1px dashed var(--ui-border); }
.expanded-contact > div { min-width:0; }
.expanded-contact dd { margin-top:.2rem; font-size:.8rem; overflow-wrap:anywhere; }
.expanded-contact a:hover { color:var(--ui-primary); text-decoration:underline; }
.appointment-actions { display:flex; align-items:center; justify-content:space-between; gap:.75rem; border-top:1px solid var(--ui-border); background:var(--ui-bg-elevated); padding:.85rem 1.25rem; }
.appointment-actions > p { color:var(--ui-text-muted); font-size:.7rem; }
.appointment-actions > div { display:flex; flex-wrap:wrap; gap:.5rem; }
@media(max-width:1100px) {
  .appointment-list { --list-grid:5rem minmax(0,1fr) minmax(0,1fr) 1rem; }
  .appointment-summary,.list-columns { gap:.75rem; padding-inline:1rem; }
}
@media(max-width:767px) {
  .list-columns { display:none; }
  .appointment-list { display:grid; gap:.7rem; border:0; border-radius:0; overflow:visible; }
  .appointment-card { border:1px solid var(--ui-border); border-radius:.75rem; }
  .appointment-summary { grid-template-columns:minmax(0,1fr) auto; gap:.85rem .75rem; padding:1rem; }
  .compact-time { display:flex; align-items:center; gap:.55rem; grid-column:1; grid-row:1; }
  .compact-time strong { font-size:1.15rem; font-weight:650; letter-spacing:-.025em; }
  .compact-time > span { margin:0; padding-left:.55rem; border-left:1px solid var(--ui-border); font-size:.7rem; overflow-wrap:anywhere; }
  .compact-duration { display:flex; align-items:center; gap:.3rem; grid-column:2; grid-row:1; justify-self:end; color:var(--ui-text-muted); font-size:.7rem; font-weight:400; }
  .compact-duration > span { width:.8rem; height:.8rem; }
  .service-duration { display:none; }
  .compact-client { grid-column:1; grid-row:2; }
  .customer-name { font-size:1.05rem; white-space:normal; overflow-wrap:anywhere; line-height:1.45; }
  .compact-phone { margin-top:.35rem; font-size:.72rem; font-weight:400; overflow-wrap:anywhere; }
  .expand-icon { grid-column:2; grid-row:2; justify-self:end; }
  .compact-service { display:block; grid-column:1 / -1; grid-row:3; border-top:1px solid var(--ui-border); padding-top:.75rem; }
  .compact-service strong { white-space:normal; font-size:.85rem; line-height:1.5; }
  .compact-service > span { margin-top:.2rem; white-space:normal; font-size:.7rem; font-weight:400; }
  .appointment-details { grid-template-columns:1fr; gap:.85rem; }
  .appointment-actions { align-items:flex-start; flex-direction:column; }
  .appointment-actions > div { width:100%; }
}
@media(max-width:639px) {
  .next-topline { padding:1rem 1.1rem; gap:.75rem; }
  .next-topline h2 { max-width:9rem; font-size:.72rem; line-height:1.5; }
  .next-topline h2 > span { flex-shrink:0; }
  .next-time { flex-direction:column; align-items:flex-end; gap:.35rem; }
  .next-time strong { font-size:1.9rem; }
  .next-time span { font-size:.7rem; }
  .next-content { grid-template-columns:minmax(0,1fr); gap:1.2rem; padding:1.1rem; }
  .next-client h3 { font-size:1.15rem; }
  .next-meta { padding-top:1rem; border-top:1px solid var(--ui-border); gap:1rem; }
  .next-footer { margin-inline:1.1rem; }
  .appointments-heading { margin-top:1.6rem; }
  .appointments-heading p { font-size:.7rem; }
}
@media(prefers-reduced-motion:reduce) { .expand-icon { transition:none; } }
</style>
