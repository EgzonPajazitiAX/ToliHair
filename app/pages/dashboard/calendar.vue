<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Kalendari | Toli Hair', robots: 'noindex, nofollow' })
const mode = ref<'day' | 'week'>('week')
const anchor = ref(localDateInZone())
const start = computed(() => mode.value === 'week' ? weekStart(anchor.value) : anchor.value)
const days = computed(() => mode.value === 'week' ? Array.from({ length: 7 }, (_, index) => shiftDate(start.value, index)) : [start.value])
const query = computed(() => ({ from: start.value, to: shiftDate(start.value, mode.value === 'week' ? 7 : 1) }))
const request = useFetch('/api/dashboard/appointments', { server: false, key: 'appointments-calendar', query })
const data = computed(() => request.data.value)
function move(direction: number) { anchor.value = shiftDate(anchor.value, direction * (mode.value === 'week' ? 7 : 1)) }
function appointmentsFor(day: string) { return data.value?.appointments.filter(item => appointmentLocalDate(item.starts_at, data.value?.timezone) === day) || [] }
function barberName(id: string) { return data.value?.barbers.find(item => item.id === id)?.name || 'Berber' }
function dayLabel(day: string) { return new Intl.DateTimeFormat('sq-XK', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)) }
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-4"><div><h1 class="sr-only">Kalendari</h1><p class="text-sm text-muted">Pamje e qartë ditore ose javore e termineve.</p></div><UButton to="/dashboard/appointments?new=1" icon="i-lucide-plus">Shto termin</UButton></div>
    <div class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-default bg-elevated p-4">
      <div class="flex gap-2"><UButton color="neutral" variant="outline" aria-label="Periudha paraprake" @click="move(-1)">←</UButton><UButton color="neutral" variant="outline" @click="anchor = localDateInZone(data?.timezone)">Sot</UButton><UButton color="neutral" variant="outline" aria-label="Periudha e ardhshme" @click="move(1)">→</UButton></div>
      <strong class="capitalize">{{ dayLabel(start) }}<template v-if="mode === 'week'"> – {{ dayLabel(days[6]!) }}</template></strong>
      <div class="flex gap-2"><UButton :variant="mode === 'day' ? 'solid' : 'ghost'" @click="mode = 'day'">Dita</UButton><UButton :variant="mode === 'week' ? 'solid' : 'ghost'" @click="mode = 'week'">Java</UButton></div>
    </div>
    <p v-if="request.status.value === 'pending'" role="status" class="mt-8">Po ngarkohet kalendari…</p>
    <UAlert v-else-if="request.error.value" class="mt-8" color="error" title="Kalendari nuk mund të ngarkohej" />
    <div v-else-if="data" class="mt-7 grid gap-4" :class="mode === 'week' ? 'md:grid-cols-2 2xl:grid-cols-7' : 'grid-cols-1'">
      <section v-for="day in days" :key="day" class="min-h-48 rounded-lg border border-default bg-default p-4" :aria-label="dayLabel(day)">
        <h2 class="border-b border-default pb-3 text-sm font-semibold capitalize">{{ dayLabel(day) }}</h2>
        <p v-if="!appointmentsFor(day).length" class="py-5 text-sm text-muted">Nuk ka termine.</p>
        <div v-else class="mt-3 space-y-3">
          <NuxtLink v-for="item in appointmentsFor(day)" :key="item.id" to="/dashboard/appointments" class="block rounded-md border-l-4 border-primary bg-elevated p-3 hover:ring-1 hover:ring-primary">
            <div class="flex items-center justify-between gap-2"><strong>{{ appointmentTime(item.starts_at, data.timezone) }}</strong><DashboardAppointmentStatus :status="item.status" /></div>
            <p class="mt-2 text-sm font-medium">{{ item.customer_name }}</p><p class="mt-1 text-xs text-muted">{{ item.service_name }} · {{ barberName(item.barber_id) }}</p>
          </NuxtLink>
        </div>
      </section>
    </div>
  </section>
</template>
