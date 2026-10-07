<script setup lang="ts">
import type { BookingReceipt } from '#shared/types/booking'

useSeoMeta({ title: 'Termini u konfirmua | Toli Hair', robots: 'noindex, nofollow' })
const receipt = useState<BookingReceipt | null>('booking-receipt', () => null)
const loading = ref(!receipt.value)
const message = ref('')

function appointmentDate(value: string) {
  return new Intl.DateTimeFormat('sq-XK', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}
function appointmentTime(value: string) {
  return new Intl.DateTimeFormat('sq-XK', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}
function appointmentDay(value: string) {
  return new Intl.DateTimeFormat('sq-XK', { timeZone: 'Europe/Belgrade', weekday: 'long' }).format(new Date(value))
}
function money(value: number) { return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: receipt.value?.currency || 'EUR' }).format(value / 100) }

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
  <section class="shell confirmation-page" aria-labelledby="confirmation-title">
    <p v-if="loading" role="status" class="rounded-2xl bg-elevated p-6">Po ngarkohet konfirmimi…</p>
    <template v-else-if="receipt">
      <header class="confirmation-heading">
        <span class="confirmation-seal" aria-hidden="true"><UIcon name="i-lucide-check" class="size-7" /></span>
        <p class="eyebrow text-primary">Gjithçka është gati</p>
        <h1 id="confirmation-title" class="display">Termini u konfirmua.</h1>
        <p>Faleminderit, <strong>{{ receipt.customerName }}</strong>.<br>Ne kujdesemi për stilin. Ti vetëm eja në orar.</p>
      </header>

      <article class="appointment-ticket" aria-label="Detajet e rezervimit">
        <div class="ticket-heading"><span class="ticket-brand"><UIcon name="i-lucide-scissors" class="size-4 shrink-0 text-primary" aria-hidden="true" /> Toli Hair</span><span class="ticket-label"><UIcon name="i-lucide-check" class="size-3.5 shrink-0" aria-hidden="true" /> Rezervuar</span></div>
        <div class="ticket-schedule">
          <div><p class="detail-label">Ora e terminit</p><time :datetime="receipt.startsAt" class="ticket-time">{{ appointmentTime(receipt.startsAt) }}</time></div>
          <div class="ticket-date"><p class="ticket-weekday">{{ appointmentDay(receipt.startsAt) }}</p><p>{{ appointmentDate(receipt.startsAt) }}</p></div>
        </div>
        <dl class="ticket-details">
          <div class="ticket-service"><dt><UIcon name="i-lucide-scissors" class="size-4 shrink-0" aria-hidden="true" /> Shërbimi</dt><dd>{{ receipt.serviceName }}</dd></div>
          <div><dt><UIcon name="i-lucide-user-round" class="size-4 shrink-0" aria-hidden="true" /> Berberi</dt><dd>{{ receipt.barberName || 'Toli Hair' }}</dd></div>
          <div><dt><UIcon name="i-lucide-clock-3" class="size-4 shrink-0" aria-hidden="true" /> Kohëzgjatja</dt><dd>{{ receipt.durationMinutes }} minuta</dd></div>
        </dl>
        <div class="ticket-total"><span>Shuma përfundimtare</span><strong>{{ money(receipt.priceMinor) }}</strong></div>
      </article>

      <div class="arrival-note"><UIcon name="i-lucide-clock-check" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><p><strong>Shihemi në Toli Hair.</strong> Paraqitu 10 minuta para terminit. Për ndryshim ose anulim, <NuxtLink to="/#kontakti">na kontakto</NuxtLink>.</p></div>
      <div class="confirmation-actions"><UButton to="/" size="xl" trailing-icon="i-lucide-arrow-up-right" class="justify-center">Kthehu në ballinë</UButton><UButton color="neutral" variant="outline" size="xl" class="justify-center" @click="newBooking">Rezervo termin tjetër</UButton></div>
    </template>
    <template v-else>
      <h1 id="confirmation-title" class="sr-only">Konfirmimi i rezervimit</h1>
      <p v-if="message" role="alert" class="mb-5 text-sm text-error">{{ message }}</p>
      <CommonEmptyState title="Nuk ka konfirmim për t’u shfaqur" description="Konfirmimi shfaqet këtu pasi të përfundosh një rezervim të vlefshëm." label="Shko te rezervimi" to="/booking" />
    </template>
  </section>
</template>

<style scoped>
.confirmation-page { max-width: 38rem; padding-block: clamp(2rem, 5vw, 3.75rem); }
.confirmation-heading { text-align: center; }
.confirmation-seal { display: grid; width: 3.5rem; height: 3.5rem; place-items: center; margin: 0 auto 1.25rem; border: 1px solid var(--color-brand-200); border-radius: 1.125rem; background: var(--color-brand-50); color: var(--ui-primary); box-shadow: 0 .25rem .75rem rgb(13 31 26 / .04); }
.confirmation-heading .eyebrow { font-size: .6rem; line-height: 1.8; }
.confirmation-heading h1 { margin-top: .75rem; font-size: clamp(2rem, 5vw, 2.8rem); }
.confirmation-heading > p:last-child { margin-top: 1rem; color: var(--ui-text-muted); font-size: .9rem; line-height: 1.8; }
.confirmation-heading strong { color: var(--ui-text); font-weight: 600; }
.appointment-ticket { margin-top: 1.75rem; overflow: hidden; border: 1px solid #d6e0d9; border-radius: 1rem; background: white; box-shadow: 0 .75rem 2rem rgb(13 31 26 / .045), 0 .125rem .25rem rgb(13 31 26 / .025); }
.ticket-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.5rem; }
.ticket-brand { display: inline-flex; align-items: center; gap: .6rem; }
.ticket-heading > span:first-child { font-size: .9rem; font-weight: 750; letter-spacing: -.04em; }
.ticket-label { display: inline-flex; align-items: center; gap: .35rem; border-radius: 999px; background: var(--color-brand-50); padding: .35rem .65rem; color: var(--ui-primary); font-size: .65rem; font-weight: 600; }
.ticket-schedule { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 1.5rem; margin-inline: 1.5rem; padding-block: 1.25rem 1.5rem; border-bottom: 1px solid var(--ui-border); }
.detail-label { color: var(--ui-text-muted); font-size: .7rem; }
.ticket-time { display: block; margin-top: .35rem; color: var(--color-brand-950); font-size: clamp(2.6rem, 8vw, 3.5rem); font-weight: 650; line-height: 1.1; letter-spacing: -.06em; font-variant-numeric: tabular-nums; }
.ticket-date { min-width: 0; text-align: right; }
.ticket-weekday { color: var(--ui-primary); font-size: 1.125rem; font-weight: 600; text-transform: capitalize; }
.ticket-date p:last-child { margin-top: .35rem; color: var(--ui-text-muted); font-size: .8rem; line-height: 1.6; }
.ticket-details { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; padding: 1.5rem; }
.ticket-service { grid-column: 1 / -1; }
.ticket-details dt { display: flex; align-items: center; gap: .5rem; color: var(--ui-text-muted); font-size: .7rem; }
.ticket-details dd { margin-top: .5rem; overflow-wrap: anywhere; font-size: .9rem; font-weight: 600; line-height: 1.6; }
.ticket-service dd { font-size: 1.05rem; letter-spacing: -.02em; }
.ticket-total { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-inline: 1.5rem; padding-block: 1.125rem; border-top: 1px dashed var(--ui-border); }
.ticket-total span { color: var(--ui-text-muted); font-size: .8rem; }
.ticket-total strong { color: var(--ui-primary); font-size: 1.6rem; font-weight: 650; letter-spacing: -.04em; white-space: nowrap; }
.arrival-note { display: flex; align-items: flex-start; gap: .75rem; margin-top: 1.25rem; padding: .875rem 1rem; border-radius: .65rem; background: var(--ui-bg-elevated); font-size: .75rem; line-height: 1.8; color: var(--ui-text-muted); }
.arrival-note strong { color: var(--ui-text); font-weight: 600; }
.arrival-note a { color: var(--ui-primary); text-decoration: underline; text-underline-offset: .2rem; }
.confirmation-actions { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin-top: 1.5rem; }
@media (max-width: 480px) {
  .ticket-heading { padding-inline: 1rem; }
  .ticket-schedule { gap: 1rem; margin-inline: 1rem; padding-block: 1rem 1.25rem; }
  .ticket-weekday { font-size: 1rem; }
  .ticket-details { padding: 1.25rem 1rem; }
  .ticket-total { margin-inline: 1rem; }
  .confirmation-actions { grid-template-columns: 1fr; }
}
</style>
