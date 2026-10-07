<script setup lang="ts">
import { CalendarDate, type DateValue } from '@internationalized/date'
import { customerSchema } from '#shared/schemas/customer'
import type { AvailabilitySlot } from '#shared/types/booking'

const embedded = false
const booking = useBooking()
const { catalog, status, error, refresh, step, date, slot, slots, loadingSlots, submitting, message, customer, serviceIds, availableServices, selectedServices, totalDuration, totalPrice, servicePrice, barbers, barber, timezone, minimumDate, maximumDate } = booking
const timeHeading = ref<HTMLElement | null>(null)

async function revealTimes(selected: string) {
  await nextTick()
  if (step.value !== 2 || date.value !== selected || !timeHeading.value) return
  timeHeading.value.focus({ preventScroll: true })
  timeHeading.value.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
}

function calendarValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new CalendarDate(year, month, day) : undefined
}
const selectedDate = computed<DateValue | undefined>({
  get: () => calendarValue(date.value),
  set: (value) => {
    date.value = value?.toString() || ''
    booking.loadSlots()
    if (date.value) void revealTimes(date.value)
  },
})
const calendarMinimum = computed(() => calendarValue(minimumDate.value))
const calendarMaximum = computed(() => calendarValue(maximumDate.value))
const slotGroups = computed(() => [
  { label: 'Paradite', slots: slots.value.filter(item => Number(item.localTime.slice(0, 2)) < 12) },
  { label: 'Pasdite', slots: slots.value.filter(item => Number(item.localTime.slice(0, 2)) >= 12 && Number(item.localTime.slice(0, 2)) < 18) },
  { label: 'Mbrëmje', slots: slots.value.filter(item => Number(item.localTime.slice(0, 2)) >= 18) },
].filter(group => group.slots.length))

function money(value: number) {
  return new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(value / 100)
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()
}
function serviceIcon(name: string) {
  const label = name.toLocaleLowerCase('sq')
  if (/mjek|rruaj|rroj/.test(label)) return 'i-lucide-scan-face'
  if (/lar|wash/.test(label)) return 'i-lucide-droplets'
  if (/fytyr|mask|trajtim/.test(label)) return 'i-lucide-sparkles'
  if (/stil|ngjyr/.test(label)) return 'i-lucide-wand-sparkles'
  return 'i-lucide-scissors'
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone.value, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}
async function chooseSlot(item: AvailabilitySlot) {
  slot.value = item
  serviceIds.value = []
  message.value = ''
  step.value = 3
  await nextTick()
  document.getElementById('service-heading')?.focus({ preventScroll: true })
}
function review() {
  message.value = ''
  const result = customerSchema.safeParse(customer)
  if (!result.success) { message.value = result.error.issues[0]?.message || 'Kontrolloni të dhënat tuaja.'; return }
  Object.assign(customer, result.data, { email: result.data.email || '' })
  step.value = 5
}
</script>

<template>
  <section :class="embedded ? 'booking-embedded' : 'shell booking-page'" aria-labelledby="booking-flow-heading">
    <h2 id="booking-flow-heading" class="sr-only">Rezervimi i terminit</h2>
    <template v-if="!embedded">
      <header class="booking-page-heading">
        <div>
          <p class="eyebrow text-primary">Toli Hair · Rezervime online</p>
          <h1 class="display mt-3 text-3xl sm:text-5xl">Koha jote. Stili yt.</h1>
          <p class="mt-3 text-sm leading-6 text-muted">Zgjidh berberin, datën dhe orën, pastaj shërbimet që të duhen.</p>
        </div>
        <span class="booking-reassurance"><UIcon name="i-lucide-calendar-check-2" class="size-4 shrink-0" />Konfirmim i menjëhershëm</span>
      </header>
    </template>
    <div v-else-if="step === 1" class="booking-intro">
      <div>
        <p class="eyebrow text-primary">Rezervo online</p>
        <p class="mt-1.5 font-display text-2xl sm:mt-2 sm:text-4xl">Zgjidh berberin</p>
      </div>
      <p class="hidden max-w-sm text-right text-sm leading-6 text-muted sm:block">Pa telefonata dhe pa llogari. Termini konfirmohet menjëherë.</p>
    </div>

    <BookingSteps :current="step" />
    <p v-if="status === 'pending' && !catalog" role="status" class="rounded-2xl bg-elevated p-6">Po përgatiten shërbimet dhe oraret…</p>
    <UAlert v-else-if="error" color="error" title="Rezervimi nuk mund të ngarkohej" description="Kontrolloni lidhjen dhe provoni përsëri." />
    <UButton v-if="error" class="mt-4" variant="outline" @click="refresh()">Provo përsëri</UButton>

    <template v-else-if="catalog">
      <CommonEmptyState v-if="!catalog.shop.booking_enabled" title="Rezervimi në internet nuk është aktiv" description="Për momentin nuk po pranojmë rezervime në internet. Na kontaktoni drejtpërdrejt për një termin." label="Kthehu te berberhania" to="/" />
      <CommonEmptyState v-else-if="!catalog.services.length" title="Nuk ka shërbime të disponueshme" description="Shërbimet do të shfaqen këtu sapo të publikohen." label="Kthehu te berberhania" to="/" />

      <div v-else class="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-7">
        <div class="booking-panel">
          <p v-if="message" role="alert" class="mb-5 rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error">{{ message }}</p>

          <section v-if="step === 3" aria-labelledby="service-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 2">← Ndrysho datën dhe orën</UButton>
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div><p class="eyebrow mt-4 text-primary">Hapi i tretë</p><h2 id="service-heading" tabindex="-1" class="mt-2 font-display text-3xl">Zgjidh shërbimet</h2></div>
              <UBadge v-if="serviceIds.length" color="primary" variant="subtle" size="lg">{{ serviceIds.length }} {{ serviceIds.length === 1 ? 'shërbim' : 'shërbime' }}</UBadge>
            </div>
            <p class="mt-3 mb-5 text-sm leading-6 text-muted">Një prerje e re apo kujdes i plotë? Zgjidh një ose disa shërbime.</p>
            <p v-if="slot" class="mb-4 rounded-lg border border-default bg-elevated p-3 text-sm"><strong>{{ dateLabel(slot.startsAt) }} · {{ slot.localTime }}</strong><span class="mt-1 block text-xs text-muted">Shfaqen shërbimet që mund të realizohen në orën e zgjedhur.</span></p>
            <div class="selected-barber-strip">
              <span class="selected-barber-avatar" aria-hidden="true">{{ initials(barber?.name || '') }}</span>
              <span class="min-w-0 flex-1"><span class="block text-xs text-muted">Berberi yt</span><strong class="block break-words text-sm">{{ barber?.name }}</strong></span>
              <UButton color="primary" variant="link" size="sm" @click="step = 1">Ndrysho</UButton>
            </div>
            <CommonEmptyState v-if="!availableServices.length" title="Nuk ka shërbime të disponueshme" description="Ky berber nuk ka ende shërbime aktive." />
            <div v-else class="service-list" role="group" aria-labelledby="service-heading">
              <UButton v-for="item in availableServices" :key="item.id" color="neutral" variant="ghost" type="button" class="service-row text-left" :class="serviceIds.includes(item.id) ? 'service-row-selected' : ''" :aria-pressed="serviceIds.includes(item.id)" @click="booking.toggleService(item.id)">
                <span class="service-icon" aria-hidden="true"><UIcon :name="serviceIcon(item.name)" class="size-5" /></span>
                <span class="service-copy">
                  <span class="service-name">{{ item.name }}</span>
                  <span v-if="item.description" class="service-description">{{ item.description }}</span>
                  <span class="choice-meta"><span class="inline-flex items-center gap-1"><UIcon name="i-lucide-clock-3" class="size-3.5" />{{ item.duration_minutes }} min</span><span aria-hidden="true">·</span><span>{{ money(servicePrice(item.price_minor)) }}</span></span>
                </span>
                <span class="selection-mark" aria-hidden="true"><UIcon :name="serviceIds.includes(item.id) ? 'i-lucide-check' : 'i-lucide-plus'" class="size-4" /></span>
              </UButton>
            </div>
            <div v-if="availableServices.length" class="booking-actions mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div aria-live="polite" aria-atomic="true"><p class="text-xs text-muted">{{ serviceIds.length ? `${serviceIds.length} ${serviceIds.length === 1 ? 'shërbim i zgjedhur' : 'shërbime të zgjedhura'}` : 'Zgjidh të paktën një shërbim' }}</p><p class="mt-1 text-sm font-semibold">{{ serviceIds.length ? `${totalDuration} min · ${money(totalPrice)}` : 'Krijo kombinimin tënd' }}</p></div>
              <UButton size="lg" trailing-icon="i-lucide-arrow-right" :loading="loadingSlots" :disabled="!serviceIds.length || loadingSlots" class="w-full justify-center sm:w-auto" @click="booking.continueFromServices">Vazhdo me të dhënat</UButton>
            </div>
          </section>

          <section v-else-if="step === 1" aria-labelledby="barber-heading">
            <p class="eyebrow text-primary">Hapi i parë</p>
            <h2 id="barber-heading" class="mt-2 font-display text-3xl">Në duart e duhura.</h2>
            <p class="mt-3 mb-6 text-sm leading-6 text-muted">Kush do të kujdeset për ty? Zgjidh një berber për të vazhduar.</p>
            <CommonEmptyState v-if="!barbers.length" title="Nuk ka berber të disponueshëm" description="Berberët aktivë do të shfaqen këtu sapo të shtohen." />
            <div v-else class="barber-grid">
              <UButton v-for="item in barbers" :key="item.id" color="neutral" variant="ghost" type="button" class="barber-card group text-left" :class="{ 'barber-card-selected': barber?.id === item.id }" :aria-label="`Zgjidh berberin ${item.name}`" @click="booking.chooseBarber(item.id)">
                <span class="barber-portrait" aria-hidden="true"><span class="barber-avatar">{{ initials(item.name) }}</span><UIcon name="i-lucide-scissors" class="barber-emblem" /></span>
                <span class="barber-card-body"><span class="barber-role">Berber · Toli Hair</span><span class="barber-name">{{ item.name }}</span><span class="barber-bio">{{ item.bio || 'Kujdes dhe përkushtim në çdo detaj.' }}</span></span>
                <span class="barber-card-footer"><span>{{ barber?.id === item.id ? 'Berberi i zgjedhur' : 'Zgjidh berberin' }}</span><span class="barber-arrow"><UIcon :name="barber?.id === item.id ? 'i-lucide-check' : 'i-lucide-arrow-up-right'" class="size-4" /></span></span>
              </UButton>
            </div>
          </section>

          <section v-else-if="step === 2" aria-labelledby="time-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 1">← Ndrysho berberin</UButton>
            <h2 id="time-heading" class="mt-4 font-display text-3xl">Zgjidh datën dhe orën</h2>
            <p class="mt-2 mb-6 text-sm text-muted">Zgjidh ditën dhe orën e fillimit. Më pas zgjidh shërbimet dhe shiko çmimin për atë orar.</p>
            <div class="schedule-picker">
              <div class="calendar-panel">
                <div class="mb-4 flex items-center justify-between gap-3"><div><p class="text-sm font-semibold">Data e vizitës</p><p class="mt-1 text-xs text-muted">Deri më {{ maximumDate }}</p></div><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" /></div>
                <UCalendar v-model="selectedDate" :min-value="calendarMinimum" :max-value="calendarMaximum" locale="sq-AL" :week-starts-on="1" :year-controls="false" size="lg" class="mx-auto w-full" :ui="{ root: 'w-full', body: 'w-full', grid: 'w-full', gridRow: 'grid grid-cols-7 place-items-center', gridWeekDaysRow: 'grid grid-cols-7', cell: 'flex justify-center', cellTrigger: 'size-9 rounded-full data-today:border-2 data-today:border-primary' }" />
              </div>
              <div class="times-panel" aria-labelledby="start-time-heading" aria-live="polite">
                <div class="mb-4"><h3 id="start-time-heading" ref="timeHeading" tabindex="-1" class="time-heading text-sm font-semibold">Ora e fillimit</h3><p class="mt-1 text-xs leading-5 text-muted">{{ date ? 'Tani zgjidh një orë të lirë' : 'Së pari zgjidh datën' }}</p></div>
                <div v-if="loadingSlots" class="time-grid" role="status" aria-label="Po kërkohen oraret e lira"><USkeleton v-for="index in 9" :key="index" class="h-11 rounded-xl" /></div>
                <div v-else-if="date && !slots.length" class="rounded-xl border border-default bg-elevated p-5 text-sm leading-6"><strong class="block">Nuk ka orare të lira.</strong><span class="text-muted">Zgjidh një datë tjetër nga kalendari.</span></div>
                <div v-else-if="!date" class="rounded-xl border border-dashed border-default p-5 text-sm leading-6 text-muted">Kliko një datë të disponueshme për të parë oraret.</div>
                <fieldset v-else class="space-y-5">
                  <div v-for="group in slotGroups" :key="group.label"><p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{{ group.label }}</p><div class="time-grid"><UButton v-for="item in group.slots" :key="`${item.barberId}-${item.startsAt}`" color="neutral" variant="ghost" type="button" class="slot-button" :class="slot?.startsAt === item.startsAt && slot?.barberId === item.barberId ? 'slot-selected' : ''" :aria-pressed="slot?.startsAt === item.startsAt && slot?.barberId === item.barberId" @click="chooseSlot(item)">{{ item.localTime }}</UButton></div></div>
                </fieldset>
              </div>
            </div>
          </section>

          <section v-else-if="step === 4" aria-labelledby="details-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 3">← Ndrysho shërbimet</UButton>
            <h2 id="details-heading" class="mt-4 font-display text-3xl" tabindex="-1">Të dhënat e tua</h2>
            <p class="mt-2 mb-6 text-sm text-muted">Do t’i përdorim vetëm për rezervimin dhe kontaktin rreth terminit.</p>
            <UForm :schema="customerSchema" :state="customer" class="grid gap-5 sm:grid-cols-2" @submit="review">
              <UFormField label="Emri dhe mbiemri" name="fullName" required class="sm:col-span-2"><UInput v-model="customer.fullName" size="xl" icon="i-lucide-user-round" autocomplete="name" placeholder="Shkruaj emrin dhe mbiemrin" :ui="{ base: 'text-base' }" class="w-full" /></UFormField>
              <UFormField label="Numri i telefonit" name="phone" required><UInput v-model="customer.phone" size="xl" icon="i-lucide-phone" type="tel" autocomplete="tel" placeholder="+383 44 123 456" :ui="{ base: 'text-base' }" class="w-full" /></UFormField>
              <UFormField label="Emaili (opsional)" name="email"><UInput v-model="customer.email" size="xl" icon="i-lucide-mail" type="email" autocomplete="email" placeholder="emri@shembull.com" :ui="{ base: 'text-base' }" class="w-full" /></UFormField>
              <UButton type="submit" size="lg" class="w-full justify-center sm:col-span-2 sm:w-fit">Shiko përmbledhjen</UButton>
            </UForm>
          </section>

          <section v-else aria-labelledby="confirm-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" :disabled="submitting" @click="step = 4">← Ndrysho të dhënat</UButton>
            <h2 id="confirm-heading" class="mt-4 font-display text-3xl">Konfirmo rezervimin</h2>
            <p class="mt-2 text-sm text-muted">Kontrollo të dhënat përpara se ta dërgosh rezervimin.</p>

            <div class="confirmation-shell">
              <div class="confirmation-appointment">
                <span class="confirmation-icon" aria-hidden="true"><UIcon name="i-lucide-calendar-check" class="size-5 shrink-0" /></span>
                <div class="min-w-0">
                  <p>Termini i zgjedhur</p>
                  <strong>{{ slot ? dateLabel(slot.startsAt) : '' }}</strong>
                  <span>{{ slot?.localTime }} · {{ barber?.name }}</span>
                </div>
                <UButton color="neutral" variant="ghost" type="button" :disabled="submitting" @click="step = 2">Ndrysho</UButton>
              </div>

              <div class="confirmation-grid">
                <section class="confirmation-card" aria-labelledby="confirmation-services">
                  <div class="confirmation-card-heading">
                    <span aria-hidden="true"><UIcon name="i-lucide-scissors" class="size-4 shrink-0" /></span>
                    <div><h3 id="confirmation-services">Shërbimet</h3><p>{{ totalDuration }} minuta gjithsej</p></div>
                    <UButton color="neutral" variant="ghost" type="button" :disabled="submitting" @click="step = 3">Ndrysho</UButton>
                  </div>
                  <ul class="confirmation-services">
                    <li v-for="item in selectedServices" :key="item.id"><span>{{ item.name }}</span><strong>{{ money(servicePrice(item.price_minor)) }}</strong></li>
                  </ul>
                </section>

                <section class="confirmation-card" aria-labelledby="confirmation-customer">
                  <div class="confirmation-card-heading">
                    <span aria-hidden="true"><UIcon name="i-lucide-user-round" class="size-4 shrink-0" /></span>
                    <div><h3 id="confirmation-customer">Të dhënat e tua</h3><p>Kontakti për rezervimin</p></div>
                    <UButton color="neutral" variant="ghost" type="button" :disabled="submitting" @click="step = 4">Ndrysho</UButton>
                  </div>
                  <dl class="confirmation-customer">
                    <div><dt>Emri</dt><dd>{{ customer.fullName }}</dd></div>
                    <div><dt>Telefoni</dt><dd>{{ customer.phone }}</dd></div>
                    <div v-if="customer.email"><dt>Emaili</dt><dd>{{ customer.email }}</dd></div>
                  </dl>
                </section>
              </div>

              <div class="confirmation-total">
                <div><span>Shuma përfundimtare</span><small>{{ selectedServices.length }} {{ selectedServices.length === 1 ? 'shërbim' : 'shërbime' }}</small></div>
                <strong>{{ money(totalPrice) }}</strong>
              </div>
            </div>

            <div class="confirmation-notice"><UIcon name="i-lucide-clock-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><p>Ju lutemi, respektojeni orarin e rezervuar dhe paraqituni në Toli Hair 10 minuta para fillimit të terminit.</p></div>
            <UButton class="mt-5 w-full justify-center sm:w-auto" size="xl" icon="i-lucide-calendar-check" :loading="submitting" :disabled="submitting" @click="booking.confirm">Konfirmo rezervimin</UButton>
          </section>
        </div>

        <aside class="booking-summary h-fit lg:sticky lg:top-24" aria-label="Përmbledhja e zgjedhjeve">
          <div class="mb-6 flex items-center justify-between"><div><p class="eyebrow text-brand-300">Vizita jote</p><h2 class="mt-2 text-lg font-semibold tracking-tight">Një moment për veten.</h2></div></div>
          <dl class="summary-details text-sm">
            <div><dt><UIcon name="i-lucide-user-round" class="size-4" />Berberi</dt><dd :class="{ 'summary-pending': !barber }">{{ barber?.name || 'Zgjidh berberin tënd' }}</dd></div>
            <div><dt><UIcon name="i-lucide-scissors" class="size-4" />Shërbimet</dt><dd v-if="selectedServices.length" class="space-y-2"><span v-for="item in selectedServices" :key="item.id" class="flex justify-between gap-3"><span>{{ item.name }}</span><span class="shrink-0 font-normal text-white/70">{{ money(servicePrice(item.price_minor)) }}</span></span></dd><dd v-else class="summary-pending">Zgjidh shërbimet pas orarit</dd></div>
            <div><dt><UIcon name="i-lucide-calendar-days" class="size-4" />Data dhe ora</dt><dd :class="{ 'summary-pending': !slot }">{{ slot ? `${dateLabel(slot.startsAt)} · ${slot.localTime}` : 'Zgjidh orarin që të përshtatet' }}</dd></div>
            <div v-if="selectedServices.length" class="summary-total"><dt>Gjithsej<span class="text-xs">{{ totalDuration }} min</span></dt><dd>{{ money(totalPrice) }}</dd></div>
          </dl>
          <p class="summary-footnote"><UIcon name="i-lucide-shield-check" class="size-4 shrink-0" />Pa llogari. Vetëm pak hapa.</p>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.booking-page { max-width: 72rem; padding-block: clamp(2rem, 5vw, 4rem); }
.booking-page-heading { display: flex; align-items: center; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; }
.booking-reassurance { display: inline-flex; flex-shrink: 0; align-items: center; gap: .5rem; color: var(--ui-primary); font-size: .75rem; }
.booking-panel { min-width: 0; container-type: inline-size; border: 1px solid var(--ui-border); border-radius: .85rem; background: white; padding: clamp(1.125rem, 3vw, 2rem); box-shadow: 0 .25rem 1.5rem rgb(13 31 26 / .025); }
.booking-panel h2 { color: var(--color-brand-950); font-weight: 650; letter-spacing: -.035em; line-height: 1.2; font-size: clamp(1.5rem, 3vw, 1.875rem); }
.booking-intro { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.25rem; }
.barber-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.barber-card { display: flex; width: 100%; min-width: 0; flex-direction: column; align-items: stretch; gap: 0; overflow: hidden; border: 1px solid var(--ui-border); border-radius: .75rem; background: white; padding: 0; white-space: normal; color: var(--ui-text); transition: border-color .2s, box-shadow .2s; }
.barber-card:hover, .barber-card-selected { border-color: var(--ui-primary); background: white; box-shadow: 0 .5rem 1.5rem rgb(13 31 26 / .07); }
.barber-portrait { position: relative; display: grid; min-height: 8rem; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 100% 0%, #d9eee4, transparent 70%), #f1f5ef; }
.barber-portrait::before, .barber-portrait::after { content: ''; position: absolute; width: 9rem; height: 9rem; border: 1px solid rgb(40 102 82 / .09); border-radius: 50%; right: -4rem; bottom: -5rem; }
.barber-portrait::after { width: 12rem; height: 12rem; right: -5.5rem; bottom: -6.5rem; }
.barber-avatar { display: grid; width: 4.25rem; height: 4.25rem; place-items: center; border: 1px solid rgb(40 102 82 / .12); border-radius: 50%; background: rgb(255 255 255 / .8); color: var(--color-brand-800); font-size: 1.375rem; font-weight: 650; letter-spacing: -.04em; }
.barber-emblem { position: absolute; top: .85rem; right: .85rem; width: 1rem; height: 1rem; color: var(--ui-primary); opacity: .55; }
.barber-card-body { display: block; flex: 1; padding: 1.125rem 1.125rem .875rem; }
.barber-role { display: block; color: var(--ui-text-muted); font-size: .625rem; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; }
.barber-name { display: block; margin-top: .35rem; overflow-wrap: anywhere; font-size: 1.125rem; font-weight: 650; letter-spacing: -.025em; }
.barber-bio { display: block; margin-top: .4rem; color: var(--ui-text-muted); font-size: .75rem; font-weight: 400; line-height: 1.65; overflow-wrap: anywhere; }
.barber-card-footer { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-inline: 1.125rem; border-top: 1px solid var(--ui-border); padding-block: .75rem; color: var(--ui-primary); font-size: .75rem; font-weight: 600; }
.barber-arrow { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border-radius: .4rem; background: var(--color-brand-50); transition: background .2s, color .2s; }
.barber-card:hover .barber-arrow { background: var(--ui-primary); color: white; }
.selected-barber-strip { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; border-radius: .5rem; background: #f5f7f4; padding: .75rem; }
.selected-barber-avatar { display: grid; width: 2.5rem; height: 2.5rem; flex-shrink: 0; place-items: center; border-radius: 50%; background: #e3ece5; color: var(--color-brand-800); font-size: .8rem; font-weight: 650; }
.service-list { display: grid; gap: .75rem; }
.service-row { display: flex; width: 100%; align-items: center; gap: 1rem; border: 1px solid var(--ui-border); border-radius: .65rem; background: white; padding: 1rem; text-align: left; white-space: normal; color: var(--ui-text); transition: background-color .15s, border-color .15s, box-shadow .15s; }
.service-row:hover { border-color: #9ab9a9; background: #fafcf9; }
.service-row-selected, .service-row-selected:hover { border-color: var(--ui-primary); background: #f2f8f4; box-shadow: inset 0 0 0 1px var(--ui-primary); }
.service-icon { display: grid; width: 2.75rem; height: 2.75rem; flex: 0 0 auto; place-items: center; border: 1px solid #e6ece5; border-radius: .6rem; background: #f5f7f3; color: var(--ui-primary); }
.service-row-selected .service-icon { border-color: #d2e6d9; background: #e2f0e7; }
.service-copy { display: block; min-width: 0; flex: 1; }
.service-name { display: block; font-size: .95rem; font-weight: 650; overflow-wrap: anywhere; }
.service-description { display: block; margin-top: .25rem; color: var(--ui-text-muted); font-size: .75rem; font-weight: 400; line-height: 1.6; overflow-wrap: anywhere; }
.choice-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: .55rem; color: var(--ui-text-muted); font-size: .75rem; font-weight: 450; }
.selection-mark { display: grid; width: 1.75rem; height: 1.75rem; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-border); border-radius: .4rem; color: var(--ui-text-muted); background: white; }
.service-row-selected .selection-mark { border-color: var(--ui-primary); background: var(--ui-primary); color: white; }
.booking-actions { border-top: 1px solid var(--ui-border); padding-top: 1.25rem; }
.back-button { color: var(--ui-text-muted); font-size: .8rem; font-weight: 650; transition: color .15s; }
.back-button:hover { color: var(--ui-primary); }
.schedule-picker { display: grid; overflow: hidden; border: 1px solid var(--ui-border); border-radius: .75rem; background: white; }
.calendar-panel, .times-panel { min-width: 0; padding: clamp(1rem, 3vw, 1.5rem); }
.times-panel { border-top: 1px solid var(--ui-border); background: #f5f7f4; }
.time-heading { scroll-margin-top: calc(var(--ui-header-height) + 1.5rem); }
.time-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
.slot-button { justify-content: center; min-height: 2.75rem; border: 1px solid var(--ui-border); border-radius: .7rem; background: white; font-size: .875rem; font-weight: 700; transition: border-color .15s, background .15s, color .15s, transform .15s; }
.slot-button:hover { border-color: var(--ui-primary); transform: translateY(-1px); }
.slot-selected, .slot-selected:hover { border-color: var(--ui-primary); background: var(--ui-primary); color: white; box-shadow: 0 .35rem 1rem color-mix(in srgb, var(--ui-primary) 25%, transparent); }
.confirmation-shell { margin-top: 1.5rem; }
.confirmation-appointment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; border-radius: .65rem; background: #12241d; padding: 1rem; color: white; }
.confirmation-icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 1px solid rgb(255 255 255 / .14); border-radius: .5rem; background: rgb(255 255 255 / .08); color: #86c4aa; }
.confirmation-appointment p { color: rgb(255 255 255 / .52); font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.confirmation-appointment strong, .confirmation-appointment div > span { display: block; }
.confirmation-appointment strong { margin-top: .2rem; overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
.confirmation-appointment div > span { margin-top: .15rem; color: rgb(255 255 255 / .62); font-size: .8rem; }
.confirmation-appointment button, .confirmation-card-heading button { color: var(--ui-primary); font-size: .75rem; font-weight: 700; }
.confirmation-appointment button { color: #a9d7c3; }
.confirmation-appointment button:hover, .confirmation-card-heading button:hover { text-decoration: underline; text-underline-offset: .2rem; }
.confirmation-grid { display: grid; }
.confirmation-card { min-width: 0; padding-block: 1.25rem; }
.confirmation-card + .confirmation-card { border-top: 1px solid var(--ui-border); }
.confirmation-card-heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .75rem; }
.confirmation-card-heading > span { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: .45rem; background: var(--color-brand-50); color: var(--ui-primary); }
.confirmation-card-heading h3 { font-size: .9rem; font-weight: 750; }
.confirmation-card-heading p { margin-top: .1rem; color: var(--ui-text-muted); font-size: .7rem; }
.confirmation-services, .confirmation-customer { margin-top: 1rem; border-top: 1px solid var(--ui-border); padding-top: .75rem; }
.confirmation-services li, .confirmation-customer > div { display: flex; min-width: 0; justify-content: space-between; gap: 1rem; padding-block: .35rem; font-size: .82rem; }
.confirmation-services span, .confirmation-customer dd { min-width: 0; overflow-wrap: anywhere; }
.confirmation-services strong { white-space: nowrap; }
.confirmation-customer dt { flex: 0 0 auto; color: var(--ui-text-muted); }
.confirmation-customer dd { text-align: right; font-weight: 600; }
.confirmation-total { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--ui-border); padding-block: 1rem; }
.confirmation-total span, .confirmation-total small { display: block; }
.confirmation-total span { font-size: .82rem; font-weight: 700; }
.confirmation-total small { margin-top: .15rem; color: var(--ui-text-muted); font-size: .7rem; }
.confirmation-total > strong { color: var(--ui-primary); font-size: 1.5rem; letter-spacing: -.03em; }
.confirmation-notice { display: flex; align-items: flex-start; gap: .65rem; margin-top: 1rem; color: var(--ui-text-muted); font-size: .72rem; line-height: 1.6; }
.summary-row { display: grid; grid-template-columns: minmax(7rem, .7fr) minmax(0, 1.3fr); gap: 1rem; padding-block: 1rem; }
.summary-row dt { color: var(--ui-text-muted); }
.summary-row dd { text-align: right; font-weight: 500; }
.booking-embedded { border: 1px solid var(--ui-border); border-radius: 1.75rem; background: rgb(255 255 255 / .94); padding: clamp(1.25rem, 3vw, 2rem); box-shadow: 0 1.5rem 4rem rgb(13 31 26 / .09); backdrop-filter: blur(1rem); }
.booking-summary { display: none; border-radius: .85rem; background: #12241d; padding: 1.4rem; color: white; }
.booking-summary dt { color: rgb(255 255 255 / .65); }
.booking-summary dd { overflow-wrap: anywhere; }
.summary-details > div + div { margin-top: 1.25rem; }
.summary-details dt { display: flex; align-items: center; gap: .5rem; font-size: .75rem; }
.summary-details dd { margin-top: .5rem; padding-left: 1.5rem; font-size: .8125rem; font-weight: 500; line-height: 1.6; }
.summary-details .summary-pending { color: rgb(255 255 255 / .6); font-weight: 400; font-size: .75rem; }
.summary-total { border-top: 1px dashed rgb(255 255 255 / .2); padding-top: 1.25rem; }
.summary-total dt { justify-content: space-between; }
.summary-total dd { padding-left: 0; font-size: 1.75rem; letter-spacing: -.04em; }
.summary-footnote { display: flex; align-items: center; gap: .5rem; margin-top: 1.5rem; border-top: 1px solid rgb(255 255 255 / .1); padding-top: 1rem; color: #b5ddcc; font-size: .7rem; }
@container (min-width: 620px) { .schedule-picker { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .times-panel { border-top: 0; border-left: 1px solid var(--ui-border); } }
@container (min-width: 580px) { .confirmation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; } .confirmation-card + .confirmation-card { border-top: 0; border-left: 1px solid var(--ui-border); padding-left: 1.25rem; } }
@media (min-width: 1024px) { .booking-summary { display: block; } }
@media (max-width: 639px) {
  .booking-page { padding-top: 1rem; }
  .booking-page-heading { display: none; }
  .barber-grid { grid-template-columns: 1fr; gap: .75rem; }
  .barber-card { display: grid; grid-template-columns: 4.25rem minmax(0, 1fr); align-items: center; padding: 1rem; gap: 0 1rem; }
  .barber-portrait { min-height: 4.25rem; border-radius: .5rem; background: #eff5ee; }
  .barber-avatar { width: 3.25rem; height: 3.25rem; font-size: 1.1rem; }
  .barber-emblem { display: none; }
  .barber-card-body { padding: 0; }
  .barber-name { font-size: 1rem; }
  .barber-card-footer { grid-column: 1 / -1; margin: .875rem 0 0; padding: .625rem 0 0; }
  .service-row { gap: .75rem; padding: .875rem; }
  .service-icon { width: 2.25rem; height: 2.25rem; }
  .service-name { font-size: .875rem; }
  .booking-intro { margin-bottom: .85rem; }
  .booking-embedded { border-radius: 1.25rem; padding: 1rem; }
  .schedule-picker { border-radius: 1rem; }
  .calendar-panel, .times-panel { padding: 1rem; }
  .back-button { display: inline-flex; min-height: 2.75rem; align-items: center; }
  .summary-row { grid-template-columns: 1fr; gap: .35rem; }
  .summary-row dd { text-align: left; }
  .confirmation-appointment { gap: .75rem; padding: 1rem; }
  .confirmation-appointment strong { white-space: normal; }
  .confirmation-card { padding-block: 1rem; }
  .booking-actions { position: sticky; bottom: .75rem; z-index: 10; margin-inline: -.5rem; border: 1px solid var(--ui-border); border-radius: .65rem; padding: 1rem; background: rgb(255 255 255 / .97); box-shadow: 0 .25rem 1.5rem rgb(13 31 26 / .09); backdrop-filter: blur(1rem); }
}
@media (max-width: 359px) {
  .booking-embedded { padding: .75rem; }
  .calendar-panel, .times-panel { padding: .75rem; }
  .time-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
