<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Përmbledhja | Toli Hair', robots: 'noindex, nofollow' })

const now = ref(Date.now())
const timezone = ref('Europe/Belgrade')
const today = computed(() => localDateInZone(timezone.value, new Date(now.value)))
const query = computed(() => ({ from: today.value, to: shiftDate(today.value, 1) }))
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-overview', query })
const data = computed(() => request.data.value)
watch(() => data.value?.timezone, value => { if (value) timezone.value = value })
const todayItems = computed(() => (data.value?.appointments ?? [])
  .filter(item => appointmentLocalDate(item.starts_at, timezone.value) === today.value)
  .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)))
const confirmed = computed(() => todayItems.value.filter(item => item.status === 'confirmed'))
const completed = computed(() => todayItems.value.filter(item => item.status === 'completed').length)
const upcoming = computed(() => confirmed.value.filter(item => Date.parse(item.starts_at) > now.value))
const next = computed(() => upcoming.value[0])
const currentCount = computed(() => confirmed.value.filter(item => Date.parse(item.starts_at) <= now.value && Date.parse(item.ends_at) > now.value).length)
const progress = computed(() => {
  const total = confirmed.value.length + completed.value
  return total ? Math.round(completed.value / total * 100) : 0
})
const stats = computed(() => [
  { label: 'Terminet e ditës', value: todayItems.value.length, note: 'Të gjitha rezervimet për sot', icon: 'i-lucide-calendar-days' },
  { label: 'Të ardhshme sot', value: upcoming.value.length, note: 'Terminet që ende nuk kanë filluar', icon: 'i-lucide-clock-3' },
  { label: 'Të përfunduara', value: completed.value, note: 'Shërbime të përfunduara sot', icon: 'i-lucide-check-check' },
])
const team = computed(() => (data.value?.barbers ?? []).map(barber => ({
  ...barber,
  count: todayItems.value.filter(item => item.barber_id === barber.id && (item.status === 'confirmed' || item.status === 'completed')).length,
})).filter(barber => barber.count > 0))
const todayLabel = computed(() => new Intl.DateTimeFormat('sq-XK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${today.value}T12:00:00Z`)))
function barberName(id: string) { return data.value?.barbers.find(item => item.id === id)?.name || 'Berber' }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() }
function phoneHref(phone: string) { return `tel:${phone.replace(/[^\d+]/g, '')}` }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <header class="overview-header">
      <div>
        <p class="section-label">Toli Hair <span>/</span> Puna e ditës</p>
        <h1 id="overview-title">Dita jote, në një vend.</h1>
        <p class="overview-date"><UIcon name="i-lucide-calendar-days" class="size-4" />{{ todayLabel }}</p>
      </div>
      <div class="header-actions">
        <UTooltip text="Rifresko të dhënat">
          <UButton icon="i-lucide-refresh-cw" size="lg" color="neutral" variant="outline" aria-label="Rifresko të dhënat" :loading="request.status.value === 'pending'" @click="request.refresh()" />
        </UTooltip>
        <UButton to="/dashboard/appointments?new=1" icon="i-lucide-plus" size="lg">Shto termin</UButton>
      </div>
    </header>

    <UAlert v-if="request.error.value" color="error" icon="i-lucide-circle-alert" title="Të dhënat nuk mund të rifreskoheshin" description="Provoni përsëri me butonin e rifreskimit. Të dhënat e shfaqura mund të mos jenë të fundit." class="mb-6" />
    <div v-if="!data && !request.error.value" role="status" aria-label="Po ngarkohen të dhënat" class="loading-grid">
      <USkeleton class="h-36 rounded-xl" />
      <USkeleton class="h-96 rounded-xl" />
    </div>
    <template v-if="data">
      <div class="stats-strip">
        <article v-for="stat in stats" :key="stat.label" class="stat">
          <div class="stat-heading"><span>{{ stat.label }}</span><UIcon :name="stat.icon" class="size-5" /></div>
          <p class="stat-number">{{ stat.value.toString().padStart(2, '0') }}</p>
          <p class="stat-note">{{ stat.note }}</p>
        </article>
      </div>

      <div class="overview-grid">
        <section class="agenda panel" aria-labelledby="agenda-title">
          <header class="panel-heading">
            <div><p class="section-label">Orari i sotëm</p><h2 id="agenda-title">Terminet e ditës <span class="count">{{ todayItems.length }}</span></h2></div>
            <UButton to="/dashboard/appointments" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" aria-label="Shiko të gjitha terminet">Të gjitha</UButton>
          </header>
          <p v-if="currentCount" class="current-note"><UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />{{ currentCount }} {{ currentCount === 1 ? 'termin në orarin aktual' : 'termine në orarin aktual' }}</p>
          <div v-if="!todayItems.length" class="empty-state">
            <span class="empty-icon"><UIcon name="i-lucide-calendar-plus" class="size-7" /></span>
            <h3>Dita është ende e lirë</h3>
            <p>Nuk ka rezervime për sot. Shto një termin ose kontrollo ditët e ardhshme në kalendar.</p>
            <UButton to="/dashboard/calendar" variant="outline" trailing-icon="i-lucide-arrow-right">Hap kalendarin</UButton>
          </div>
          <ol v-else class="appointment-list">
            <li v-for="item in todayItems" :key="item.id" class="appointment-row" :class="{ 'is-next': item.id === next?.id, 'is-cancelled': item.status === 'cancelled' }">
              <div class="appointment-time"><strong>{{ appointmentTime(item.starts_at, timezone) }}</strong><span>{{ item.duration_minutes }} min</span></div>
              <span class="avatar" aria-hidden="true">{{ initials(item.customer_name) }}</span>
              <div class="appointment-copy">
                <h3>{{ item.customer_name }}</h3>
                <p>{{ item.service_name }}</p>
                <span class="barber-label">{{ barberName(item.barber_id) }}</span>
              </div>
              <div class="appointment-status"><span v-if="item.id === next?.id" class="next-label">I radhës</span><DashboardAppointmentStatus :status="item.status" /></div>
            </li>
          </ol>
          <footer class="agenda-footer"><UIcon name="i-lucide-sliders-horizontal" class="size-4 shrink-0" /><span>Ndrysho orarin ose statusin nga <NuxtLink to="/dashboard/appointments">menaxhimi i termineve</NuxtLink>.</span></footer>
        </section>

        <aside class="overview-aside" aria-label="Planifikimi i ditës">
          <section class="next-card" aria-labelledby="next-title">
            <div class="next-heading"><h2 id="next-title">Termini i radhës</h2><UIcon name="i-lucide-arrow-up-right" class="size-5" /></div>
            <template v-if="next">
              <div class="next-time">{{ appointmentTime(next.starts_at, timezone) }}<span>Sot · {{ next.duration_minutes }} min</span></div>
              <h3>{{ next.customer_name }}</h3>
              <a :href="phoneHref(next.customer_phone)" class="next-phone"><UIcon name="i-lucide-phone" class="size-3.5" />{{ next.customer_phone }}</a>
              <dl class="next-details"><div><dt>Shërbimi</dt><dd>{{ next.service_name }}</dd></div><div><dt>Berberi</dt><dd>{{ barberName(next.barber_id) }}</dd></div></dl>
            </template>
            <div v-else class="next-empty"><UIcon name="i-lucide-calendar-check-2" class="size-8" /><h3>Asnjë termin i ardhshëm për sot</h3><p>Rezervimet e konfirmuara për më vonë shfaqen këtu.</p></div>
            <UButton to="/dashboard/appointments" size="lg" color="neutral" variant="solid" trailing-icon="i-lucide-arrow-right" class="next-action">Hap terminet</UButton>
          </section>

          <section class="team-card panel" aria-labelledby="team-title">
            <div class="panel-heading"><div><p class="section-label">Ngarkesa e ditës</p><h2 id="team-title">Ekipi sot</h2></div><UIcon name="i-lucide-users-round" class="size-5 text-muted" /></div>
            <ul v-if="team.length" class="team-list"><li v-for="barber in team" :key="barber.id"><span class="avatar" aria-hidden="true">{{ initials(barber.name) }}</span><span class="team-name">{{ barber.name }}</span><span class="team-count">{{ barber.count }} {{ barber.count === 1 ? 'termin' : 'termine' }}</span></li></ul>
            <p v-else class="team-empty">Nuk ka termine aktive ose të përfunduara për sot.</p>
            <div class="day-progress"><div><span>Të përfunduara</span><strong>{{ progress }}%</strong></div><UProgress :model-value="progress" size="xs" aria-label="Përqindja e termineve të përfunduara" /><p>Nga terminet e konfirmuara dhe të përfunduara të ditës.</p></div>
          </section>
          <NuxtLink to="/dashboard/calendar" class="calendar-shortcut"><UIcon name="i-lucide-calendar-range" class="size-5 shrink-0" /><span><strong>Planifiko ditët në vazhdim</strong><small>Shiko orarin në kalendar</small></span><UIcon name="i-lucide-arrow-right" class="size-4 shrink-0" /></NuxtLink>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.overview { --line: var(--ui-border); --muted: var(--ui-text-muted); }
.overview-header { display:flex; justify-content:space-between; align-items:center; gap:1.5rem; margin-bottom:2rem; }
.section-label { color:var(--muted); font-size:.65rem; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
.section-label span { margin-inline:.6rem; opacity:.45; }
h1 { margin-top:.6rem; color:var(--ui-text-highlighted); font-size:clamp(1.7rem,3vw,2.5rem); font-weight:650; letter-spacing:-.045em; line-height:1.2; }
.overview-date { display:flex; align-items:center; gap:.5rem; margin-top:.8rem; color:var(--muted); font-size:.8rem; }
.overview-date::first-letter { text-transform:uppercase; }
.header-actions { display:flex; gap:.6rem; flex-shrink:0; }
.stats-strip { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border:1px solid var(--line); border-radius:1rem; background:var(--ui-bg); overflow:hidden; margin-bottom:1.5rem; }
.stat { padding:1.4rem 1.6rem; }
.stat + .stat { border-left:1px solid var(--line); }
.stat-heading { display:flex; align-items:center; justify-content:space-between; gap:.75rem; font-size:.8rem; font-weight:600; }
.stat-heading > :last-child { color:var(--ui-primary); flex-shrink:0; }
.stat-number { margin:.65rem 0 .25rem; font-size:2.5rem; line-height:1.1; font-weight:600; letter-spacing:-.055em; font-variant-numeric:tabular-nums; color:var(--ui-text-highlighted); }
.stat-note { font-size:.7rem; color:var(--muted); line-height:1.6; }
.overview-grid { display:grid; grid-template-columns:minmax(0,1fr) 19rem; align-items:start; gap:1.5rem; }
.panel { border:1px solid var(--line); border-radius:1rem; background:var(--ui-bg); overflow:hidden; min-width:0; }
.panel-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.4rem; }
.panel-heading h2 { margin-top:.35rem; font-size:1rem; font-weight:650; letter-spacing:-.025em; color:var(--ui-text-highlighted); }
.count { display:inline-block; margin-left:.4rem; padding:.1rem .45rem; border-radius:.35rem; background:var(--ui-bg-elevated); font-size:.7rem; vertical-align:middle; }
.current-note { display:flex; gap:.5rem; align-items:center; padding:.7rem 1.4rem; background:var(--ui-bg-elevated); font-size:.75rem; }
.appointment-row { display:grid; grid-template-columns:3.3rem 2.3rem minmax(0,1fr) auto; align-items:center; gap:.85rem; padding:1.1rem 1.4rem; border-top:1px solid var(--line); border-left:3px solid transparent; }
.appointment-row.is-next { background:color-mix(in srgb,var(--ui-primary) 5%,var(--ui-bg)); border-left-color:var(--ui-primary); }
.appointment-time strong { display:block; font-size:.9rem; font-weight:650; font-variant-numeric:tabular-nums; }
.appointment-time > span { display:block; margin-top:.25rem; color:var(--muted); font-size:.65rem; }
.avatar { display:grid; place-items:center; width:2.3rem; height:2.3rem; border-radius:50%; background:var(--ui-bg-elevated); color:var(--ui-text-muted); font-size:.7rem; font-weight:600; }
.appointment-copy { min-width:0; }
.appointment-copy h3 { font-size:.85rem; font-weight:600; overflow-wrap:anywhere; }
.appointment-copy p { margin-top:.2rem; color:var(--muted); font-size:.72rem; overflow-wrap:anywhere; }
.barber-label { display:block; margin-top:.3rem; color:var(--muted); font-size:.65rem; }
.is-cancelled .appointment-time strong { color:var(--muted); text-decoration:line-through; }
.appointment-status { display:flex; flex-direction:column; align-items:flex-end; gap:.35rem; }
.next-label { font-size:.6rem; color:var(--ui-primary); font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.agenda-footer { display:flex; align-items:flex-start; gap:.6rem; padding:1rem 1.4rem; border-top:1px solid var(--line); color:var(--muted); font-size:.7rem; line-height:1.7; }
.agenda-footer a { color:var(--ui-primary); text-decoration:underline; text-underline-offset:3px; }
.empty-state { display:flex; flex-direction:column; align-items:center; text-align:center; padding:3.5rem 1.5rem; border-top:1px solid var(--line); }
.empty-icon { display:grid; place-items:center; width:3.5rem; height:3.5rem; border-radius:1rem; background:var(--ui-bg-elevated); color:var(--ui-primary); }
.empty-state h3 { margin-top:1.2rem; font-weight:600; }
.empty-state p { max-width:20rem; margin:.5rem 0 1.5rem; font-size:.8rem; line-height:1.8; color:var(--muted); }
.overview-aside { display:grid; gap:1.25rem; min-width:0; }
.next-card { padding:1.5rem; border-radius:1rem; background:#19372f; color:#fff; }
.next-heading { display:flex; justify-content:space-between; align-items:center; color:#bad8cb; font-size:.75rem; }
.next-time { margin:1.6rem 0 1.4rem; font-size:2.9rem; font-weight:500; letter-spacing:-.05em; line-height:1; font-variant-numeric:tabular-nums; }
.next-time span { display:block; margin-top:.65rem; font-size:.7rem; letter-spacing:0; color:#bad8cb; }
.next-card h3 { font-size:1.15rem; font-weight:600; overflow-wrap:anywhere; }
.next-phone { display:flex; align-items:center; gap:.5rem; width:fit-content; margin-top:.55rem; font-size:.8rem; color:#d1e4db; }
.next-phone:hover { color:white; text-decoration:underline; }
.next-details { display:grid; gap:.85rem; margin:1.3rem 0; padding-top:1.2rem; border-top:1px solid #ffffff26; }
.next-details div { display:grid; grid-template-columns:4.5rem minmax(0,1fr); gap:.6rem; font-size:.75rem; }
.next-details dt { color:#bad8cb; }
.next-details dd { text-align:right; overflow-wrap:anywhere; }
.next-action { width:100%; justify-content:center; background:#e2eee6; color:#19372f; }
.next-action:hover { background:#fff; color:#19372f; }
.next-empty { padding:1.8rem 0; }
.next-empty > :first-child { color:#bad8cb; margin-bottom:1rem; }
.next-empty p { margin-top:.6rem; color:#bad8cb; font-size:.78rem; line-height:1.7; }
.team-list { padding:0 1.4rem; }
.team-list li { display:flex; align-items:center; gap:.65rem; padding:.7rem 0; border-top:1px solid var(--line); }
.team-name { min-width:0; flex:1; font-size:.78rem; overflow-wrap:anywhere; font-weight:550; }
.team-count { font-size:.65rem; color:var(--muted); flex-shrink:0; }
.team-empty { padding:0 1.4rem 1rem; font-size:.8rem; line-height:1.6; color:var(--muted); }
.day-progress { margin:1rem 1.4rem 1.4rem; padding-top:1rem; border-top:1px solid var(--line); }
.day-progress > div:first-child { display:flex; justify-content:space-between; margin-bottom:.65rem; font-size:.7rem; }
.day-progress p { margin-top:.6rem; color:var(--muted); font-size:.65rem; line-height:1.6; }
.calendar-shortcut { display:flex; align-items:center; gap:.75rem; padding:1rem; border:1px solid var(--line); border-radius:.8rem; transition:background .2s; }
.calendar-shortcut:hover { background:var(--ui-bg-elevated); }
.calendar-shortcut > span:nth-child(2) { flex:1; }
.calendar-shortcut strong,.calendar-shortcut small { display:block; }
.calendar-shortcut strong { font-size:.75rem; font-weight:600; }
.calendar-shortcut small { margin-top:.2rem; font-size:.65rem; color:var(--muted); }
.calendar-shortcut:focus-visible,.next-phone:focus-visible { outline:2px solid var(--ui-primary); outline-offset:4px; }
.loading-grid { display:grid; gap:1.5rem; }
@media(max-width:1199px) { .overview-grid { grid-template-columns:minmax(0,1fr); } .overview-aside { grid-template-columns:repeat(2,minmax(0,1fr)); align-items:start; } .calendar-shortcut { grid-column:1 / -1; } }
@media(max-width:639px) { .overview-header { align-items:flex-start; flex-direction:column; gap:1.25rem; } .header-actions { width:100%; } .header-actions > :last-child { flex:1; justify-content:center; } .stats-strip { border-radius:.8rem; } .stat { padding:1rem .65rem; } .stat-heading { font-size:.68rem; line-height:1.5; } .stat-heading > :last-child { display:none; } .stat-number { font-size:2rem; } .stat-note { display:none; } .overview-aside { grid-template-columns:minmax(0,1fr); } .panel-heading { padding:1.2rem 1rem; gap:.5rem; } .appointment-row { grid-template-columns:3rem minmax(0,1fr); padding:1rem; gap:.5rem .75rem; } .appointment-row > .avatar { display:none; } .appointment-status { grid-column:2; flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:flex-start; margin-top:.15rem; gap:.5rem; } .agenda-footer { padding:1rem; } .next-card { padding:1.4rem; } }
</style>
