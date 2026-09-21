<script setup lang="ts">
import type { BookingReceipt } from '#shared/types/booking'

useSeoMeta({ title: 'Termini u konfirmua | Toli Hair', robots: 'noindex, nofollow' })
const receipt = useState<BookingReceipt | null>('booking-receipt', () => null)
const loading = ref(!receipt.value)
const message = ref('')

function appointmentDate(value: string) {
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
  const time = new Intl.DateTimeFormat('sq-XK', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  return `${date}, ${time}`
}
function money(value: number) { return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(value / 100) }

async function loadReceipt() {
  if (receipt.value) { loading.value = false; return }
  try {
    const token = sessionStorage.getItem('toli-booking-receipt')
    if (!token) return
    const result = await $fetch<{ receipt: BookingReceipt }>('/api/booking/receipt', { method: 'POST', headers: { 'x-toli-request': '1' }, body: { token } })
    receipt.value = result.receipt
  }
  catch (error: unknown) {
    const failure = error as { data?: { statusMessage?: string } }
    message.value = failure.data?.statusMessage || 'Konfirmimi nuk mund të ngarkohej.'
  }
  finally { loading.value = false }
}
function newBooking() {
  receipt.value = null
  try { sessionStorage.removeItem('toli-booking-receipt') }
  catch { /* Storage may be unavailable in restricted browsers. */ }
  return navigateTo('/booking')
}
onMounted(loadReceipt)
</script>

<template>
  <section class="shell section-space max-w-3xl">
    <p v-if="loading" role="status" class="rounded-2xl bg-elevated p-6">Po ngarkohet konfirmimi…</p>
    <template v-else-if="receipt">
      <div class="mb-7 grid size-14 place-items-center rounded-2xl bg-success text-white shadow-lg shadow-success/15" aria-hidden="true"><UIcon name="i-lucide-check" class="size-7" /></div>
      <p class="eyebrow mb-3 text-primary">Rezervimi përfundoi</p>
      <h1 class="display text-4xl sm:text-6xl">Termini u konfirmua.</h1>
      <p class="mt-5 max-w-xl leading-7 text-muted">Faleminderit, {{ receipt.customerName }}. Termini yt është ruajtur me sukses.</p>
      <UCard class="mt-9" :ui="{ body: 'p-5 sm:p-7' }">
        <dl class="divide-y divide-default">
          <div class="receipt-row"><dt>Shërbimi</dt><dd>{{ receipt.serviceName }}</dd></div>
          <div class="receipt-row"><dt>Berberi</dt><dd>{{ receipt.barberName || 'Toli Hair' }}</dd></div>
          <div class="receipt-row"><dt>Data dhe ora</dt><dd>{{ appointmentDate(receipt.startsAt) }}</dd></div>
          <div class="receipt-row"><dt>Kohëzgjatja</dt><dd>{{ receipt.durationMinutes }} minuta</dd></div>
          <div class="receipt-row"><dt>Çmimi</dt><dd>{{ money(receipt.priceMinor) }}</dd></div>
          <div class="receipt-row"><dt>Numri i rezervimit</dt><dd class="break-all font-mono text-xs">{{ receipt.appointmentId }}</dd></div>
        </dl>
      </UCard>
      <p class="mt-6 text-sm leading-6 text-muted">Ruaje numrin e rezervimit. Nëse ke nevojë për ndryshim ose anulim, kontakto Toli Hair.</p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row"><UButton to="/" size="lg" class="justify-center">Kthehu në ballinë</UButton><UButton color="neutral" variant="outline" size="lg" class="justify-center" @click="newBooking">Rezervo termin tjetër</UButton></div>
    </template>
    <template v-else>
      <p v-if="message" role="alert" class="mb-5 text-sm text-error">{{ message }}</p>
      <CommonEmptyState title="Nuk ka konfirmim për t’u shfaqur" description="Konfirmimi shfaqet këtu pasi të përfundosh një rezervim të vlefshëm." label="Shko te rezervimi" to="/booking" />
    </template>
  </section>
</template>

<style scoped>
.receipt-row { display: grid; grid-template-columns: minmax(8rem, .8fr) minmax(0, 1.2fr); gap: 1rem; padding-block: 1rem; }
.receipt-row dt { color: var(--ui-text-muted); }
.receipt-row dd { text-align: right; font-weight: 600; }
@media (max-width: 480px) { .receipt-row { grid-template-columns: 1fr; gap: .3rem; } .receipt-row dd { text-align: left; } }
</style>
