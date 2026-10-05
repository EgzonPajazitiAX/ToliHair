<script setup lang="ts">
import type { AppointmentRecord } from '#shared/types/appointments'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Kalendari | Toli Hair', robots: 'noindex, nofollow' })

const mode = ref<'day' | 'week'>('week')
const anchor = ref(localDateInZone())
const barberFilter = ref('all')
const start = computed(() => mode.value === 'week' ? weekStart(anchor.value) : anchor.value)
const days = computed(() => mode.value === 'week' ? Array.from({ length: 7 }, (_, index) => shiftDate(start.value, index)) : [start.value])
const query = computed(() => ({ from: start.value, to: shiftDate(start.value, mode.value === 'week' ? 7 : 1) }))
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-calendar', query })
const data = computed(() => request.data.value)
const clock = ref(Date.now())
const today = computed(() => localDateInZone(data.value?.timezone, new Date(clock.value)))
const appointments = computed(() => (data.value?.appointments ?? [])
  .filter(item => barberFilter.value === 'all' || item.barber_id === barberFilter.value)
  .toSorted((first, second) => Date.parse(first.starts_at) - Date.parse(second.starts_at) || first.customer_name.localeCompare(second.customer_name)))
const grouped = computed(() => {
  const groups = new Map<string, AppointmentRecord[]>()
  for (const item of appointments.value) {
    const day = appointmentLocalDate(item.starts_at, data.value?.timezone)
    const items = groups.get(day) ?? []
    items.push(item)
    groups.set(day, items)
  }
  return groups
})
const selectedItems = computed(() => appointmentsFor(anchor.value))
const monthLabel = computed(() => formatDate(anchor.value, { month: 'long', year: 'numeric' }))
const periodLabel = computed(() => mode.value === 'day'
  ? dayLabel(anchor.value)
  : `${formatDate(start.value, { day: 'numeric', month: 'short' })} – ${formatDate(days.value[6]!, { day: 'numeric', month: 'short' })}`)
const barberOptions = computed(() => [{ label: 'Të gjithë berberët', value: 'all' }, ...(data.value?.barbers ?? []).map(barber => ({ label: barber.name, value: barber.id }))])
const preview = ref<AppointmentRecord | null>(null)
const previewOpen = computed({ get: () => preview.value !== null, set: value => { if (!value) preview.value = null } })
const selectedBarber = computed(() => barberFilter.value === 'all' ? 'Të gjithë berberët' : barberName(barberFilter.value))

function move(direction: number) { anchor.value = shiftDate(anchor.value, direction * (mode.value === 'week' ? 7 : 1)) }
function appointmentsFor(day: string) { return grouped.value.get(day) ?? [] }
function barberName(id: string) { return data.value?.barbers.find(item => item.id === id)?.name || 'Berber' }
function formatDate(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('sq-XK', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
}
function dayLabel(day: string) { return formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' }) }
function weekday(day: string) {
  const index = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
  return ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'][index]
}
function money(item: AppointmentRecord) { return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: item.currency }).format(item.price_minor / 100) }
function phoneHref(phone: string) { return `tel:${phone.replace(/[^\d+]/g, '')}` }
function selectDay(day: string) { anchor.value = day }
function showDay(day: string) { selectDay(day); mode.value = 'day' }

let clockTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { clockTimer = setInterval(() => { clock.value = Date.now() }, 60_000) })
onBeforeUnmount(() => { if (clockTimer) clearInterval(clockTimer) })
</script>

<template>
  <section class="calendar-page" aria-labelledby="calendar-title">
    <header class="page-heading">
      <div><h1 id="calendar-title">Kalendari i termineve</h1><p>Planifiko ditën dhe shiko rezervimet e ekipit.</p></div>
      <UButton to="/dashboard/appointments?new=1" icon="i-lucide-plus" size="lg" class="add-appointment">Shto termin</UButton>
    </header>

    <div class="calendar-workspace">
      <div class="calendar-toolbar">
        <div class="period-heading"><h2>{{ monthLabel }}</h2><p>{{ periodLabel }}</p></div>
        <div class="date-navigation">
          <UButton color="neutral" variant="outline" size="sm" class="today-button" @click="anchor = today">Sot</UButton>
          <div class="period-arrows">
            <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-left" size="sm" :aria-label="mode === 'week' ? 'Java paraprake' : 'Dita paraprake'" @click="move(-1)" />
            <UButton color="neutral" variant="ghost" icon="i-lucide-chevron-right" size="sm" :aria-label="mode === 'week' ? 'Java e ardhshme' : 'Dita e ardhshme'" @click="move(1)" />
          </div>
        </div>
        <div class="calendar-controls">
          <USelect v-model="barberFilter" :items="barberOptions" aria-label="Filtro sipas berberit" icon="i-lucide-users-round" class="barber-filter" />
          <div class="view-switch" role="group" aria-label="Pamja e kalendarit">
            <button type="button" :aria-pressed="mode === 'day'" :class="{ active: mode === 'day' }" @click="mode = 'day'">Dita</button>
            <button type="button" :aria-pressed="mode === 'week'" :class="{ active: mode === 'week' }" @click="mode = 'week'">Java</button>
          </div>
        </div>
      </div>

      <nav v-if="mode === 'week'" class="week-picker" aria-label="Zgjidh ditën e javës">
        <button v-for="day in days" :key="day" type="button" class="week-day" :class="{ selected: day === anchor, 'is-today': day === today }" :aria-label="`${dayLabel(day)}${day === today ? ', sot' : ''}`" :aria-pressed="day === anchor" :aria-current="day === today ? 'date' : undefined" @click="selectDay(day)">
          <span>{{ weekday(day) }}</span><strong>{{ Number(day.slice(-2)) }}</strong>
          <span class="day-marker" :class="{ 'has-bookings': appointmentsFor(day).length > 0 }" aria-hidden="true" />
        </button>
      </nav>

      <div v-if="request.status.value === 'pending'" class="calendar-loading" role="status" aria-label="Po ngarkohet kalendari">
        <USkeleton class="h-5 w-44 rounded-md" /><USkeleton class="h-24 w-full rounded-xl" /><USkeleton class="h-24 w-full rounded-xl" />
      </div>
      <UAlert v-else-if="request.error.value" color="error" icon="i-lucide-circle-alert" title="Kalendari nuk mund të ngarkohej" description="Provoni përsëri me butonin e rifreskimit." class="m-4" />
      <template v-else-if="data">
        <div v-if="mode === 'week'" class="week-board-scroll" role="region" aria-label="Rezervimet e javës" tabindex="0">
          <div class="week-board">
            <section v-for="day in days" :key="day" class="day-column" :class="{ 'today-column': day === today }" :aria-label="dayLabel(day)">
              <button type="button" class="column-header" :aria-label="`Hap ${dayLabel(day)}`" @click="showDay(day)">
                <span class="column-weekday">{{ weekday(day) }}<small v-if="day === today">Sot</small></span>
                <span class="column-date">{{ Number(day.slice(-2)) }}</span>
                <span class="column-total">{{ appointmentsFor(day).length }} {{ appointmentsFor(day).length === 1 ? 'termin' : 'termine' }}</span>
              </button>
              <div class="column-appointments">
                <p v-if="!appointmentsFor(day).length" class="column-empty"><span aria-hidden="true">—</span>Pa rezervime</p>
                <button v-for="item in appointmentsFor(day)" :key="item.id" type="button" class="week-event" :class="`event-${item.status}`" :aria-label="`${item.customer_name}, ${appointmentTime(item.starts_at, data.timezone)}, ${appointmentStatuses[item.status].label}; hap hollësitë`" @click="preview = item">
                  <span class="event-time">{{ appointmentTime(item.starts_at, data.timezone) }}<small>{{ item.duration_minutes }} min</small></span>
                  <strong>{{ item.customer_name }}</strong>
                  <span class="event-service">{{ item.service_name }}</span>
                  <span class="event-barber"><UIcon name="i-lucide-user-round" class="size-3 shrink-0" />{{ barberName(item.barber_id) }}</span>
                  <span class="event-status"><span aria-hidden="true" />{{ appointmentStatuses[item.status].label }}</span>
                </button>
              </div>
            </section>
          </div>
        </div>

        <section class="day-agenda" :class="{ 'mobile-agenda': mode === 'week' }" :aria-label="`Terminet për ${dayLabel(anchor)}`">
          <header class="agenda-heading"><div><p>{{ anchor === today ? 'Orari i sotëm' : 'Orari i ditës' }}</p><h2>{{ dayLabel(anchor) }}</h2></div><span class="agenda-count">{{ selectedItems.length }} {{ selectedItems.length === 1 ? 'termin' : 'termine' }}</span></header>
          <div v-if="!selectedItems.length" class="day-empty"><span class="empty-icon"><UIcon name="i-lucide-calendar-days" class="size-6" /></span><h3>Nuk ka rezervime për këtë ditë</h3><p>{{ barberFilter === 'all' ? 'Zgjidh një ditë tjetër ose shto një termin të ri.' : `Nuk ka termine për ${selectedBarber}. Mund të shikosh të gjithë berberët.` }}</p><UButton v-if="barberFilter !== 'all'" color="neutral" variant="outline" @click="barberFilter = 'all'">Shiko të gjithë</UButton><UButton v-else to="/dashboard/appointments?new=1" color="primary" variant="outline" icon="i-lucide-plus">Shto termin</UButton></div>
          <ol v-else class="day-events">
            <li v-for="item in selectedItems" :key="item.id">
              <button type="button" class="day-event" :class="`event-${item.status}`" :aria-label="`${item.customer_name}, ${appointmentTime(item.starts_at, data.timezone)}; hap hollësitë`" @click="preview = item">
                <span class="day-event-time"><UIcon name="i-lucide-clock-3" class="size-3.5" /><strong>{{ appointmentTime(item.starts_at, data.timezone) }}</strong><span>– {{ appointmentTime(item.ends_at, data.timezone) }}</span></span>
                <span class="day-event-status"><DashboardAppointmentStatus :status="item.status" /></span>
                <span class="day-event-client"><strong>{{ item.customer_name }}</strong><span>{{ item.service_name }}</span></span>
                <UIcon name="i-lucide-arrow-up-right" class="day-event-arrow size-4" aria-hidden="true" />
                <span class="day-event-meta"><span><UIcon name="i-lucide-user-round" class="size-3.5" />{{ barberName(item.barber_id) }}</span><span>{{ item.duration_minutes }} minuta</span></span>
              </button>
            </li>
          </ol>
        </section>
      </template>

      <footer class="calendar-footer"><span>{{ selectedBarber }}<span class="footer-divider" aria-hidden="true">·</span>{{ periodLabel }}</span><UTooltip text="Rifresko kalendarin"><UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-refresh-cw" aria-label="Rifresko kalendarin" :loading="request.status.value === 'pending'" @click="request.refresh()" /></UTooltip></footer>
    </div>

    <UModal v-model:open="previewOpen" title="Hollësitë e terminit" description="Shiko klientin, orarin dhe shërbimin e rezervuar." :ui="{ content: 'max-w-lg' }">
      <template #body>
        <div v-if="preview" class="booking-preview">
          <div class="preview-heading"><h3>{{ preview.customer_name }}</h3><DashboardAppointmentStatus :status="preview.status" /></div>
          <div class="preview-date"><UIcon name="i-lucide-calendar-days" class="size-5 shrink-0" /><span><strong>{{ dayLabel(appointmentLocalDate(preview.starts_at, data?.timezone)) }}</strong><small>{{ appointmentTime(preview.starts_at, data?.timezone) }} – {{ appointmentTime(preview.ends_at, data?.timezone) }} · {{ preview.duration_minutes }} minuta</small></span></div>
          <dl class="preview-details"><div><dt>Shërbimi</dt><dd>{{ preview.service_name }}</dd></div><div><dt>Berberi</dt><dd>{{ barberName(preview.barber_id) }}</dd></div><div><dt>Çmimi</dt><dd>{{ money(preview) }}</dd></div><div><dt>Telefoni</dt><dd><a :href="phoneHref(preview.customer_phone)">{{ preview.customer_phone }}</a></dd></div><div v-if="preview.customer_email"><dt>Emaili</dt><dd><a :href="`mailto:${preview.customer_email}`">{{ preview.customer_email }}</a></dd></div><div><dt>Burimi</dt><dd>{{ preview.source === 'online' ? 'Rezervim online' : 'Shtuar nga stafi' }}</dd></div></dl>
        </div>
      </template>
      <template #footer><div class="preview-actions"><UButton color="neutral" variant="outline" @click="previewOpen = false">Mbyll</UButton><UButton to="/dashboard/appointments" trailing-icon="i-lucide-arrow-up-right">Menaxho terminet</UButton></div></template>
    </UModal>
  </section>
</template>

<style scoped>
.calendar-page { min-width:0; }
.page-heading { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; margin-bottom:1.5rem; }
.page-heading h1 { color:var(--ui-text-highlighted); font-size:clamp(1.45rem,2.5vw,2rem); letter-spacing:-.04em; font-weight:650; line-height:1.3; }
.page-heading p { margin-top:.45rem; color:var(--ui-text-muted); font-size:.8rem; line-height:1.7; }
.add-appointment { flex-shrink:0; }
.calendar-workspace { border:1px solid var(--ui-border); border-radius:1rem; background:var(--ui-bg); overflow:hidden; }
.calendar-toolbar { display:flex; align-items:center; gap:1.25rem; padding:1.4rem; border-bottom:1px solid var(--ui-border); }
.period-heading { min-width:0; }
.period-heading h2 { color:var(--ui-text-highlighted); font-size:1.15rem; font-weight:600; letter-spacing:-.025em; text-transform:capitalize; }
.period-heading p { margin-top:.3rem; color:var(--ui-text-muted); font-size:.7rem; }
.date-navigation { display:flex; align-items:center; gap:.4rem; }
.today-button { border-radius:.5rem; }
.period-arrows { display:flex; }
.calendar-controls { display:flex; align-items:center; gap:.75rem; margin-left:auto; }
.barber-filter { width:12.5rem; }
.view-switch { display:flex; gap:.2rem; border:1px solid var(--ui-border); padding:.2rem; border-radius:.6rem; background:var(--ui-bg-elevated); }
.view-switch button { min-width:3.2rem; padding:.4rem .6rem; border-radius:.4rem; font-size:.75rem; color:var(--ui-text-muted); cursor:pointer; }
.view-switch button.active { background:var(--ui-bg); color:var(--ui-text-highlighted); box-shadow:0 1px 3px rgb(18 36 29 / .1); font-weight:600; }
.view-switch button:hover { color:var(--ui-primary); }
.week-picker { display:none; }
.week-board-scroll { overflow-x:auto; overscroll-behavior-inline:contain; scrollbar-width:thin; scrollbar-color:var(--ui-border) transparent; }
.week-board { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); min-width:980px; }
.day-column { min-width:0; }
.day-column + .day-column { border-left:1px solid var(--ui-border); }
.column-header { display:flex; width:100%; min-height:7rem; flex-direction:column; align-items:center; gap:.45rem; padding:1rem .6rem; border-bottom:1px solid var(--ui-border); cursor:pointer; }
.column-header:hover { background:var(--ui-bg-elevated); }
.column-weekday { display:flex; align-items:center; gap:.4rem; font-size:.72rem; color:var(--ui-text-muted); }
.column-weekday small { border-radius:.25rem; padding:.05rem .3rem; font-size:.55rem; background:var(--ui-primary); color:white; }
.column-date { display:grid; width:2rem; height:2rem; place-items:center; font-size:1.1rem; font-weight:550; font-variant-numeric:tabular-nums; border-radius:50%; }
.today-column .column-date { background:var(--ui-primary); color:white; }
.today-column .column-header { background:color-mix(in srgb,var(--ui-primary) 4%,var(--ui-bg)); }
.column-total { font-size:.62rem; color:var(--ui-text-muted); }
.column-appointments { display:grid; align-content:start; gap:.6rem; padding:.65rem; min-height:22rem; }
.column-empty { display:flex; align-items:center; flex-direction:column; gap:.7rem; padding:2rem .25rem; color:var(--ui-text-muted); font-size:.65rem; }
.column-empty > span { opacity:.4; font-size:1.3rem; }
.week-event { --event-color:var(--ui-primary); display:flex; flex-direction:column; align-items:stretch; text-align:left; gap:.5rem; padding:.7rem .6rem; border:1px solid color-mix(in srgb,var(--event-color) 18%,var(--ui-border)); border-left:2px solid var(--event-color); border-radius:.5rem; background:color-mix(in srgb,var(--event-color) 5%,var(--ui-bg)); cursor:pointer; min-width:0; transition:background .15s; }
.week-event:hover { background:color-mix(in srgb,var(--event-color) 10%,var(--ui-bg)); }
.calendar-page .event-cancelled { --event-color:var(--ui-text-muted); }
.calendar-page .event-completed { --event-color:#50836c; }
.calendar-page .event-no_show { --event-color:#aa7b39; }
.event-time { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:.25rem; font-variant-numeric:tabular-nums; font-size:.75rem; font-weight:650; }
.event-time small { font-size:.58rem; font-weight:400; color:var(--ui-text-muted); }
.week-event > strong { color:var(--ui-text-highlighted); font-size:.72rem; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }
.event-service { font-size:.63rem; color:var(--ui-text-muted); line-height:1.6; overflow-wrap:anywhere; }
.event-barber { display:flex; align-items:center; gap:.25rem; font-size:.6rem; overflow-wrap:anywhere; }
.event-status { display:flex; align-items:center; gap:.3rem; padding-top:.45rem; border-top:1px solid color-mix(in srgb,var(--event-color) 15%,transparent); color:var(--event-color); font-size:.56rem; }
.event-status > span { width:.3rem; height:.3rem; border-radius:50%; background:currentColor; flex-shrink:0; }
.event-cancelled .event-time { text-decoration:line-through; }
.mobile-agenda { display:none; }
.day-agenda { padding:1.5rem; }
.agenda-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }
.agenda-heading p { font-size:.65rem; color:var(--ui-text-muted); margin-bottom:.35rem; }
.agenda-heading h2 { font-size:1rem; font-weight:600; color:var(--ui-text-highlighted); text-transform:capitalize; letter-spacing:-.025em; line-height:1.5; }
.agenda-count { flex-shrink:0; font-size:.65rem; border:1px solid var(--ui-border); border-radius:999px; padding:.35rem .65rem; color:var(--ui-text-muted); }
.day-events { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.85rem; }
.day-event { --event-color:var(--ui-primary); display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.85rem; width:100%; text-align:left; padding:1.15rem; border:1px solid var(--ui-border); border-radius:.8rem; background:var(--ui-bg); cursor:pointer; }
.day-event:hover { border-color:color-mix(in srgb,var(--event-color) 45%,var(--ui-border)); background:color-mix(in srgb,var(--event-color) 3%,var(--ui-bg)); }
.day-event-time { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; font-size:.8rem; font-variant-numeric:tabular-nums; }
.day-event-time > :first-child { color:var(--event-color); }
.day-event-time strong { font-weight:600; }
.day-event-time > span:last-child { font-size:.7rem; color:var(--ui-text-muted); }
.day-event-status { justify-self:end; }
.day-event-client { min-width:0; }
.day-event-client strong { display:block; font-size:.95rem; line-height:1.5; font-weight:600; overflow-wrap:anywhere; }
.day-event-client > span { display:block; margin-top:.3rem; color:var(--ui-text-muted); font-size:.75rem; line-height:1.6; overflow-wrap:anywhere; }
.day-event-arrow { justify-self:end; color:var(--ui-text-muted); }
.day-event-meta { display:flex; align-items:center; justify-content:space-between; gap:.75rem; grid-column:1 / -1; border-top:1px solid var(--ui-border); padding-top:.8rem; color:var(--ui-text-muted); font-size:.7rem; }
.day-event-meta > span:first-child { display:flex; align-items:center; gap:.4rem; overflow-wrap:anywhere; }
.day-event-meta > span:last-child { flex-shrink:0; }
.day-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:3rem 1rem; }
.empty-icon { display:grid; place-items:center; width:3rem; height:3rem; border-radius:.85rem; background:var(--ui-bg-elevated); color:var(--ui-primary); }
.day-empty h3 { margin-top:1rem; font-size:.9rem; font-weight:600; }
.day-empty p { max-width:19rem; margin:.5rem 0 1.25rem; color:var(--ui-text-muted); font-size:.75rem; line-height:1.8; }
.calendar-footer { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:.65rem 1.4rem; border-top:1px solid var(--ui-border); color:var(--ui-text-muted); font-size:.65rem; }
.calendar-footer > span { line-height:1.7; }
.footer-divider { padding-inline:.5rem; }
.calendar-loading { display:grid; gap:1rem; padding:1.5rem; }
.preview-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; }
.preview-heading h3 { font-size:1.2rem; font-weight:600; letter-spacing:-.025em; overflow-wrap:anywhere; }
.preview-date { display:flex; align-items:center; gap:.85rem; padding:1rem; border:1px solid var(--ui-border); border-radius:.75rem; background:color-mix(in srgb,var(--ui-primary) 5%,var(--ui-bg)); color:var(--ui-primary); }
.preview-date strong { display:block; font-size:.85rem; font-weight:550; text-transform:capitalize; }
.preview-date small { display:block; color:var(--ui-text-muted); font-size:.75rem; margin-top:.35rem; }
.preview-details { margin-top:1.25rem; }
.preview-details > div { display:grid; grid-template-columns:5rem minmax(0,1fr); gap:1rem; padding:.8rem 0; border-bottom:1px solid var(--ui-border); font-size:.8rem; }
.preview-details dt { color:var(--ui-text-muted); }
.preview-details dd { text-align:right; overflow-wrap:anywhere; }
.preview-details a { color:var(--ui-primary); text-decoration:underline; text-underline-offset:3px; }
.preview-actions { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.75rem; width:100%; }
.week-event:focus-visible,.day-event:focus-visible,.column-header:focus-visible,.week-day:focus-visible,.view-switch button:focus-visible { outline:2px solid var(--ui-primary); outline-offset:-3px; }
@media(min-width:768px) { .day-agenda.mobile-agenda { display:none; } }
@media(max-width:1100px) { .calendar-toolbar { flex-wrap:wrap; gap:1rem; } .date-navigation { margin-left:auto; } .calendar-controls { width:100%; margin-left:0; justify-content:space-between; } .barber-filter { width:min(16rem,65%); } }
@media(max-width:767px) {
  .page-heading { align-items:flex-start; }
  .page-heading h1 { font-size:1.35rem; }
  .page-heading p { font-size:.75rem; max-width:16rem; }
  .calendar-toolbar { padding:1.15rem 1rem; }
  .period-heading h2 { font-size:1rem; }
  .calendar-workspace { border-radius:.85rem; }
  .week-picker { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:.15rem; padding:.9rem .55rem; border-bottom:1px solid var(--ui-border); }
  .week-day { display:flex; flex-direction:column; align-items:center; gap:.5rem; padding:.5rem .1rem; border-radius:.7rem; cursor:pointer; }
  .week-day > span:first-child { font-size:.62rem; color:var(--ui-text-muted); }
  .week-day strong { display:grid; place-items:center; width:2rem; height:2rem; border-radius:50%; font-size:.85rem; font-weight:600; font-variant-numeric:tabular-nums; }
  .week-day.is-today strong { box-shadow:inset 0 0 0 1px var(--ui-primary); color:var(--ui-primary); }
  .week-day.selected { background:color-mix(in srgb,var(--ui-primary) 6%,var(--ui-bg)); }
  .week-day.selected strong { background:var(--ui-primary); color:white; }
  .day-marker { width:.25rem; height:.25rem; border-radius:50%; background:transparent; }
  .day-marker.has-bookings { background:var(--ui-primary); }
  .week-day:hover { background:var(--ui-bg-elevated); }
  .week-board-scroll { display:none; }
  .day-agenda,.day-agenda.mobile-agenda { display:block; padding:1.15rem 1rem; }
  .agenda-heading { gap:.5rem; margin-bottom:1rem; }
  .agenda-heading h2 { font-size:.9rem; }
  .agenda-count { padding:.3rem .5rem; font-size:.6rem; }
  .day-events { grid-template-columns:minmax(0,1fr); gap:.7rem; }
  .day-event { padding:1rem; gap:.8rem .5rem; }
  .day-event-time { gap:.3rem; }
  .day-event-time > span:last-child { display:none; }
  .day-event-client strong { font-size:.9rem; }
  .day-event-client > span { font-size:.72rem; }
  .calendar-footer { padding:.55rem 1rem; }
  .day-empty { padding:2rem .5rem; }
}
@media(max-width:479px) { .page-heading { flex-direction:column; gap:.9rem; } .add-appointment { width:100%; justify-content:center; } .period-heading p { font-size:.65rem; } .calendar-toolbar { gap:.85rem .5rem; } .date-navigation { gap:.1rem; } .view-switch button { min-width:2.6rem; padding:.4rem .5rem; } .barber-filter { width:min(12rem,65%); } .preview-heading { flex-direction:column; gap:.6rem; } }
@media(prefers-reduced-motion:reduce) { .week-event { transition:none; } }
</style>
