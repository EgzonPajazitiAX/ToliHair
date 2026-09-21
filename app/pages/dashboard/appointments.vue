<script setup lang="ts">
import type { AppointmentRecord, AppointmentStatus } from '#shared/types/appointments'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Terminet | Toli Hair', robots: 'noindex, nofollow' })
const route = useRoute()
const toast = useToast()
const today = localDateInZone()
const defaultTo = shiftDate(today, 30)
const draft = reactive({ from: today, to: defaultTo, barberId: '', status: '', query: '' })
const applied = reactive({ ...draft })
const apiQuery = computed(() => ({ ...applied, to: shiftDate(applied.to, 1) }))
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-list', query: apiQuery })
const data = computed(() => request.data.value)
const now = ref(Date.now())
const nextAppointment = computed(() => data.value?.appointments
  .filter(item => item.status === 'confirmed' && new Date(item.starts_at).getTime() > now.value)
  .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime())[0])
const activeFilterCount = computed(() => [
  applied.from !== today || applied.to !== defaultTo,
  Boolean(applied.barberId),
  Boolean(applied.status),
  Boolean(applied.query),
].filter(Boolean).length)
const editor = ref<AppointmentRecord | null | 'new'>(route.query.new === '1' ? 'new' : null)
const pending = ref('')
const message = ref('')
const filtersOpen = ref(false)
const autoRefreshing = ref(false)
const autoRefreshInterval = 30_000
let autoRefreshTimer: ReturnType<typeof setInterval> | undefined
let refreshController: AbortController | undefined
watch(apiQuery, () => refreshController?.abort(), { flush: 'sync' })
watch(() => request.status.value, status => { if (status === 'pending') refreshController?.abort() }, { flush: 'sync' })

function applyFilters() { Object.assign(applied, draft); editor.value = null; filtersOpen.value = false }
function clearFilters() { Object.assign(draft, { from: today, to: defaultTo, barberId: '', status: '', query: '' }); applyFilters() }
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
  if (autoRefreshing.value || request.status.value === 'pending' || document.visibilityState !== 'visible') return
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

async function changeStatus(item: AppointmentRecord, status: Exclude<AppointmentStatus, 'confirmed'>) {
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
      <div><h1 class="sr-only">Terminet</h1><p class="text-sm text-muted">Kërkoni, ndryshoni dhe ndiqni çdo vizitë nga një vend.</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <UPopover v-model:open="filtersOpen" :content="{ align: 'end', side: 'bottom', sideOffset: 8 }">
          <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-list-filter">
            Filtro
            <UBadge v-if="activeFilterCount" color="primary" variant="solid" size="sm">{{ activeFilterCount }}</UBadge>
          </UButton>
          <template #content>
            <form class="filter-panel" @submit.prevent="applyFilters">
              <div class="mb-4 flex items-start justify-between gap-4"><div><h2 class="font-semibold">Filtro terminet</h2><p class="mt-1 text-xs text-muted">Kufizo listën sipas datës, berberit ose statusit.</p></div><UButton type="button" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Mbyll filtrat" @click="filtersOpen = false" /></div>
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Nga"><UInput v-model="draft.from" type="date" required class="w-full" :max="draft.to" /></UFormField>
                <UFormField label="Deri"><UInput v-model="draft.to" type="date" required class="w-full" :min="draft.from" /></UFormField>
                <UFormField label="Berberi"><USelect :model-value="draft.barberId || 'all'" :items="[{ label: 'Të gjithë berberët', value: 'all' }, ...(data?.barbers || []).map(item => ({ label: item.name, value: item.id }))]" class="w-full" @update:model-value="draft.barberId = $event === 'all' ? '' : $event" /></UFormField>
                <UFormField label="Statusi"><USelect :model-value="draft.status || 'all'" :items="[{ label: 'Të gjitha statuset', value: 'all' }, ...Object.entries(appointmentStatuses).map(([value, item]) => ({ label: item.label, value }))]" class="w-full" @update:model-value="draft.status = $event === 'all' ? '' : $event" /></UFormField>
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
    <div v-if="editor && data" class="mt-7"><DashboardAppointmentForm :data="data" :appointment="editor === 'new' ? null : editor" @saved="saved" @cancel="editor = null" /></div>
    <p v-if="request.status.value === 'pending' && !data" role="status" class="mt-8">Po ngarkohen terminet…</p>
    <UAlert v-else-if="request.error.value && !data" class="mt-8" color="error" title="Terminet nuk mund të ngarkoheshin" description="Provoni përsëri pas pak." />
    <CommonEmptyState v-else-if="!data?.appointments.length" class="mt-8" title="Nuk u gjet asnjë termin" description="Ndryshoni filtrat ose krijoni një termin të ri manualisht." />
    <template v-else>
      <article v-if="nextAppointment" class="next-appointment" aria-labelledby="next-title">
        <div class="next-topline"><h2 id="next-title"><span class="live-dot" aria-hidden="true" /> Termini i radhës</h2><span>{{ barberName(nextAppointment.barber_id) }}</span></div>
        <div class="next-content">
          <div class="next-time"><strong>{{ appointmentTime(nextAppointment.starts_at, data!.timezone) }}</strong><span>{{ appointmentDate(nextAppointment.starts_at) }}</span></div>
          <div class="next-client"><h3>{{ nextAppointment.customer_name }}</h3><a :href="`tel:${nextAppointment.customer_phone.replace(/[^\d+]/g, '')}`"><UIcon name="i-lucide-phone" />{{ nextAppointment.customer_phone }}</a><p>{{ nextAppointment.service_name }} · {{ nextAppointment.duration_minutes }} min</p></div>
          <UButton color="primary" variant="soft" size="sm" icon="i-lucide-pencil" @click="editor = nextAppointment">Ndrysho</UButton>
        </div>
      </article>

      <div class="appointments-heading"><div><h2>Të gjitha terminet</h2><p>{{ data!.appointments.length }} rezultate në periudhën e zgjedhur</p></div><UBadge v-if="activeFilterCount" color="primary" variant="subtle">{{ activeFilterCount }} {{ activeFilterCount === 1 ? 'filtër aktiv' : 'filtra aktivë' }}</UBadge></div>
      <div class="appointment-list">
      <UCollapsible v-for="item in data.appointments" :key="item.id" class="appointment-card">
        <UButton color="neutral" variant="ghost" class="appointment-summary w-full text-left">
          <span class="customer-avatar" aria-hidden="true">{{ item.customer_name.charAt(0).toUpperCase() }}</span>
          <span class="compact-client">
            <span class="customer-name">{{ item.customer_name }}</span>
            <span class="compact-phone"><UIcon name="i-lucide-phone" />{{ item.customer_phone }}</span>
            <span class="compact-badges"><DashboardAppointmentStatus :status="item.status" /><span class="compact-barber">{{ barberName(item.barber_id) }}</span></span>
          </span>
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
            <UButton size="sm" color="error" variant="outline" @click="changeStatus(item, 'cancelled')">{{ pending === `${item.id}:cancelled` ? 'Konfirmo anulimin' : 'Anulo' }}</UButton>
          </div>
        </footer>
        </template>
      </UCollapsible>
      </div>
    </template>
  </section>
</template>

<style scoped>
.field { display:flex; flex-direction:column; gap:.45rem; font-size:.8rem; font-weight:600; }
.filter-panel { width:min(30rem,calc(100vw - 2rem)); max-height:80svh; overflow:auto; padding:1.25rem; }
.live-dot { width:.4rem; height:.4rem; flex-shrink:0; border-radius:50%; background:currentColor; }
.next-appointment { margin-top:1.25rem; border:1px solid var(--color-brand-200); border-radius:.6rem; background:linear-gradient(115deg,var(--color-brand-50),var(--ui-bg) 75%); overflow:hidden; }
.next-topline { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.7rem 1rem; border-bottom:1px solid var(--color-brand-100); color:var(--ui-text-muted); font-size:.75rem; }
.next-topline h2 { display:flex; align-items:center; gap:.5rem; color:var(--ui-primary); font-weight:700; flex-shrink:0; }
.next-topline > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.next-content { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:1.25rem; padding:1rem; }
.next-time { text-align:center; padding-right:1.25rem; border-right:1px solid var(--color-brand-200); }
.next-time strong { display:block; font-size:2rem; line-height:1.1; font-weight:750; letter-spacing:-.05em; font-variant-numeric:tabular-nums; color:var(--ui-primary); }
.next-time span { display:block; margin-top:.3rem; font-size:.75rem; }
.next-client h3 { font-size:1.05rem; font-weight:700; overflow-wrap:anywhere; }
.next-client a { display:flex; align-items:center; gap:.35rem; margin-top:.3rem; font-size:.8rem; width:fit-content; }
.next-client p { margin-top:.25rem; font-size:.75rem; color:var(--ui-text-muted); overflow-wrap:anywhere; }
.appointments-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:1.5rem 0 .75rem; }
.appointments-heading h2 { font-size:.95rem; font-weight:700; }
.appointments-heading p { margin-top:.2rem; color:var(--ui-text-muted); font-size:.75rem; }
.appointment-list { display:grid; gap:.5rem; }
.appointment-card { min-width:0; border:1px solid var(--ui-border); border-radius:.6rem; background:var(--ui-bg); overflow:hidden; }
.appointment-card[data-state="open"] { border-color:var(--color-brand-300); }
.appointment-summary { display:grid; grid-template-columns:2.5rem minmax(0,1fr) auto 1rem; align-items:center; gap:.85rem; padding:.85rem 1rem; cursor:pointer; list-style:none; }
.appointment-summary::-webkit-details-marker { display:none; }
.appointment-summary:hover { background:var(--color-brand-50); }
.appointment-summary:focus-visible { outline:2px solid var(--ui-primary); outline-offset:-3px; border-radius:.6rem; }
.customer-avatar { display:grid; width:2.5rem; height:2.5rem; align-self:start; place-items:center; border-radius:50%; background:#12241d; color:white; font-size:.95rem; font-weight:750; }
.compact-client { display:block; min-width:0; }
.customer-name { display:block; font-size:.95rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.compact-phone { display:flex; align-items:center; gap:.35rem; margin-top:.2rem; font-size:.75rem; color:var(--ui-text-muted); }
.compact-phone svg,.next-client a svg { width:.8rem; height:.8rem; flex-shrink:0; }
.compact-badges { display:flex; align-items:center; gap:.5rem; margin-top:.5rem; min-width:0; }
.compact-barber { font-size:.7rem; color:var(--ui-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.compact-time { text-align:right; align-self:start; padding-top:.1rem; }
.compact-time strong { display:block; font-size:1rem; font-weight:750; font-variant-numeric:tabular-nums; }
.compact-time > span { display:block; margin-top:.25rem; font-size:.7rem; color:var(--ui-text-muted); }
.expand-icon { width:1rem; height:1rem; color:var(--ui-text-muted); transition:transform .15s; }
.appointment-card[data-state="open"] .expand-icon { transform:rotate(180deg); }
.appointment-details { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; border-top:1px solid var(--ui-border); background:var(--ui-bg-elevated); padding:1rem; }
.appointment-detail { display:flex; align-items:flex-start; gap:.6rem; min-width:0; }
.appointment-detail > div { min-width:0; }
.detail-icon { display:grid; place-items:center; color:var(--ui-primary); padding-top:.15rem; flex-shrink:0; }
.detail-icon svg { width:1rem; height:1rem; }
.card-label,.expanded-contact dt { color:var(--ui-text-muted); font-size:.7rem; }
.appointment-detail strong { display:block; margin-top:.25rem; font-size:.8rem; font-weight:600; overflow-wrap:anywhere; }
.appointment-detail div > span { display:block; margin-top:.25rem; color:var(--ui-text-muted); font-size:.75rem; }
.appointment-detail div > span svg { display:inline-block; vertical-align:middle; width:.8rem; height:.8rem; }
.expanded-contact { display:flex; flex-wrap:wrap; gap:.75rem 2rem; padding:.85rem 1rem; border-top:1px solid var(--ui-border); }
.expanded-contact > div { min-width:0; }
.expanded-contact dd { margin-top:.2rem; font-size:.8rem; overflow-wrap:anywhere; }
.expanded-contact a:hover,.next-client a:hover { color:var(--ui-primary); text-decoration:underline; }
.appointment-actions { display:flex; align-items:center; justify-content:space-between; gap:.75rem; border-top:1px solid var(--ui-border); padding:.75rem 1rem; }
.appointment-actions > p { color:var(--ui-text-muted); font-size:.7rem; }
.appointment-actions > div { display:flex; flex-wrap:wrap; gap:.5rem; }
@media(max-width:639px) {
  .appointment-summary { grid-template-columns:2.25rem minmax(0,1fr) auto .85rem; gap:.6rem; padding:.8rem; }
  .customer-avatar { width:2.25rem; height:2.25rem; }
  .next-content { gap:.85rem; padding:.85rem; }
  .next-time { padding-right:.85rem; }
  .next-time strong { font-size:1.65rem; }
  .next-content > a,.next-content > button { grid-column:2 / -1; justify-self:start; }
  .appointment-details { grid-template-columns:1fr; gap:.85rem; }
  .appointment-actions { align-items:flex-start; flex-direction:column; }
}
@media(prefers-reduced-motion:reduce) { .expand-icon { transition:none; } }
</style>
