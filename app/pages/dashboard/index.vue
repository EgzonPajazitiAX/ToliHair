<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Përmbledhja | Toli Hair', robots: 'noindex, nofollow' })
const today = localDateInZone()
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-overview', query: { from: today, to: shiftDate(today, 8) } })
const data = computed(() => request.data.value)
const todayItems = computed(() => data.value?.appointments.filter(item => appointmentLocalDate(item.starts_at, data.value?.timezone) === today) || [])
const confirmed = computed(() => data.value?.appointments.filter(item => item.status === 'confirmed') || [])
const completed = computed(() => todayItems.value.filter(item => item.status === 'completed').length)
const stats = computed(() => [
  { label: 'Terminet sot', value: todayItems.value.length, icon: 'i-lucide-calendar-check-2', tone: 'bg-primary/10 text-primary' },
  { label: 'Të konfirmuara këtë javë', value: confirmed.value.length, icon: 'i-lucide-clock-3', tone: 'bg-info/10 text-info' },
  { label: 'Të përfunduara sot', value: completed.value, icon: 'i-lucide-circle-check-big', tone: 'bg-success/10 text-success' },
])
const todayLabel = new Intl.DateTimeFormat('sq-XK', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${today}T12:00:00Z`))
function barberName(id: string) { return data.value?.barbers.find(item => item.id === id)?.name || 'Berber' }
</script>

<template>
  <section>
    <h1 class="sr-only">Përmbledhja</h1>
    <div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><p class="text-sm text-muted">Mirë se erdhët në panelin e Toli Hair</p><p class="mt-1 text-lg font-semibold capitalize text-highlighted">{{ todayLabel }}</p></div>
      <UButton to="/dashboard/appointments?new=1" icon="i-lucide-plus" size="lg">Shto termin</UButton>
    </div>
    <p v-if="request.status.value === 'pending'" role="status" class="py-12 text-sm text-muted">Po ngarkohen të dhënat…</p>
    <UAlert v-else-if="request.error.value" color="error" icon="i-lucide-circle-alert" title="Përmbledhja nuk mund të ngarkohej" description="Provoni përsëri pas pak." />
    <template v-else-if="data">
      <div class="grid gap-4 sm:grid-cols-3">
        <UCard v-for="stat in stats" :key="stat.label">
          <div class="flex items-start justify-between gap-4"><div><p class="text-sm text-muted">{{ stat.label }}</p><p class="mt-2 text-3xl font-semibold tracking-tight text-highlighted">{{ stat.value }}</p></div><span class="grid size-10 place-items-center rounded-lg" :class="stat.tone"><UIcon :name="stat.icon" class="size-5" /></span></div>
        </UCard>
      </div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(17rem,.5fr)]">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="flex items-center justify-between gap-4 border-b border-default px-5 py-4 sm:px-6"><div><h2 class="font-semibold text-highlighted">Terminet e sotme</h2><p class="mt-1 text-xs text-muted">Orari dhe klientët e ditës</p></div><UButton to="/dashboard/appointments" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right">Të gjitha</UButton></div>
          <div v-if="!todayItems.length" class="px-5 py-12 text-center sm:px-6"><UIcon name="i-lucide-calendar-check" class="mx-auto size-8 text-dimmed" /><p class="mt-3 text-sm font-medium">Nuk ka termine për sot</p><p class="mt-1 text-xs text-muted">Terminet e reja do të shfaqen këtu.</p></div>
          <div v-else class="divide-y divide-default">
            <div v-for="item in todayItems" :key="item.id" class="flex items-center gap-4 px-5 py-4 sm:px-6"><div class="w-14 shrink-0 text-sm font-semibold text-primary">{{ appointmentTime(item.starts_at, data.timezone) }}</div><div class="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated text-xs font-bold">{{ item.customer_name.charAt(0).toUpperCase() }}</div><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">{{ item.customer_name }}</p><p class="mt-0.5 truncate text-xs text-muted">{{ item.service_name }} · {{ barberName(item.barber_id) }}</p></div><DashboardAppointmentStatus :status="item.status" /></div>
          </div>
        </UCard>
        <UCard><h2 class="font-semibold text-highlighted">Veprime të shpejta</h2><p class="mt-1 text-xs leading-5 text-muted">Detyrat që përdoren më shpesh.</p><div class="mt-5 grid gap-2"><UButton to="/dashboard/appointments" color="neutral" variant="soft" icon="i-lucide-calendar-plus" class="justify-start">Menaxho terminet</UButton><UButton to="/dashboard/calendar" color="neutral" variant="soft" icon="i-lucide-calendar-days" class="justify-start">Hap kalendarin</UButton><UButton to="/dashboard/working-hours" color="neutral" variant="soft" icon="i-lucide-clock-3" class="justify-start">Ndrysho orarin</UButton></div></UCard>
      </div>
    </template>
  </section>
</template>
