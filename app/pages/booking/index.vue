<script setup lang="ts">
import { CalendarDate, type DateValue } from '@internationalized/date'
import { customerSchema } from '#shared/schemas/customer'
import type { AvailabilitySlot } from '#shared/types/booking'

const embedded = false
const booking = useBooking()
const { catalog, status, error, refresh, step, date, slot, slots, loadingSlots, submitting, message, customer, serviceIds, availableServices, selectedServices, totalDuration, totalPrice, barbers, barber, timezone, minimumDate, maximumDate } = booking

function calendarValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new CalendarDate(year, month, day) : undefined
}
const selectedDate = computed<DateValue | undefined>({
  get: () => calendarValue(date.value),
  set: (value) => {
    date.value = value?.toString() || ''
    booking.loadSlots()
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
function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone.value, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}
async function chooseSlot(item: AvailabilitySlot) {
  slot.value = item
  message.value = ''
  step.value = 4
  await nextTick()
  document.getElementById('details-heading')?.focus({ preventScroll: true })
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
  <section :class="embedded ? 'booking-embedded' : 'shell section-space max-w-5xl'" aria-labelledby="booking-flow-heading">
    <h2 id="booking-flow-heading" class="sr-only">Rezervimi i terminit</h2>
    <template v-if="!embedded">
      <p class="eyebrow mb-4 text-primary">Rezervim i shpejtë dhe i sigurt</p>
      <h1 class="display mb-5 text-5xl sm:text-6xl">Rezervo vizitën tënde.</h1>
      <p class="mb-10 max-w-2xl leading-7 text-muted">Zgjidh shërbimin, berberin dhe orën që të përshtatet. Nuk nevojitet llogari dhe termini konfirmohet menjëherë.</p>
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

      <div v-else class="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <div>
          <p v-if="message" role="alert" class="mb-5 rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error">{{ message }}</p>

          <section v-if="step === 2" aria-labelledby="service-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 1">← Ndrysho berberin</UButton>
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div><p class="eyebrow mt-4 text-primary">Hapi i dytë</p><h2 id="service-heading" class="mt-2 font-display text-3xl">Zgjidh shërbimet</h2></div>
              <UBadge v-if="serviceIds.length" color="primary" variant="subtle" size="lg">{{ serviceIds.length }} {{ serviceIds.length === 1 ? 'shërbim' : 'shërbime' }}</UBadge>
            </div>
            <p class="mt-3 mb-6 text-sm leading-6 text-muted">Shërbimet e {{ barber?.name }}. Mund të zgjedhësh më shumë se një; koha dhe çmimi llogariten automatikisht.</p>
            <CommonEmptyState v-if="!availableServices.length" title="Nuk ka shërbime të disponueshme" description="Ky berber nuk ka ende shërbime aktive." />
            <div v-else class="service-list">
              <UButton v-for="item in availableServices" :key="item.id" color="neutral" variant="ghost" type="button" class="service-row text-left" :class="serviceIds.includes(item.id) ? 'service-row-selected' : ''" :aria-pressed="serviceIds.includes(item.id)" @click="booking.toggleService(item.id)">
                <span class="flex items-start gap-3">
                  <span class="service-icon"><UIcon name="i-lucide-scissors" class="size-4" /></span>
                  <span class="min-w-0 flex-1"><span class="block font-bold">{{ item.name }}</span><span class="mt-1 block text-xs leading-5 text-muted">{{ item.description || 'Shërbim profesional nga ekipi ynë.' }}</span></span>
                  <span class="selection-mark" aria-hidden="true">{{ serviceIds.includes(item.id) ? '✓' : '+' }}</span>
                </span>
                <span class="choice-meta"><span class="flex items-center gap-1.5"><UIcon name="i-lucide-clock-3" class="size-3.5" />{{ item.duration_minutes }} min</span><strong>{{ money(item.price_minor) }}</strong></span>
              </UButton>
            </div>
            <div v-if="availableServices.length" class="booking-actions mt-6 flex flex-col gap-4 rounded-2xl border border-default bg-elevated p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div><p class="text-sm text-muted">Kombinimi yt</p><p class="mt-1 font-semibold">{{ serviceIds.length ? `${totalDuration} minuta · ${money(totalPrice)}` : 'Ende pa shërbime' }}</p></div>
              <UButton size="lg" trailing-icon="i-lucide-arrow-right" :disabled="!serviceIds.length" class="w-full justify-center sm:w-auto" @click="booking.continueFromServices">Zgjidh datën dhe orën</UButton>
            </div>
          </section>

          <section v-else-if="step === 1" aria-labelledby="barber-heading">
            <p class="eyebrow text-primary">Hapi i parë</p>
            <h2 id="barber-heading" class="mt-2 font-display text-3xl">Kush do të kujdeset për ty?</h2>
            <p class="mt-3 mb-6 text-sm leading-6 text-muted">Zgjidh berberin që dëshiron. Në hapin tjetër do të shfaqen shërbimet që ofron.</p>
            <CommonEmptyState v-if="!barbers.length" title="Nuk ka berber të disponueshëm" description="Berberët aktivë do të shfaqen këtu sapo të shtohen." />
            <div v-else class="barber-grid">
              <UButton v-for="item in barbers" :key="item.id" color="neutral" variant="ghost" type="button" class="barber-card group text-left" @click="booking.chooseBarber(item.id)">
                <span class="barber-avatar">{{ item.name.charAt(0).toUpperCase() }}</span>
                <span class="min-w-0 flex-1"><span class="block text-base font-bold">{{ item.name }}</span><span class="mt-1 block text-xs leading-5 text-muted">{{ item.bio || 'Pjesë e ekipit Toli Hair.' }}</span><span class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">Zgjidh berberin <UIcon name="i-lucide-arrow-right" class="size-3.5 transition-transform group-hover:translate-x-1" /></span></span>
              </UButton>
            </div>
          </section>

          <section v-else-if="step === 3" aria-labelledby="time-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 2">← Ndrysho shërbimet</UButton>
            <h2 id="time-heading" class="mt-4 font-display text-3xl">Zgjidh datën dhe orën</h2>
            <p class="mt-2 mb-6 text-sm text-muted">Zgjidh ditën dhe një orar të lirë. Pas zgjedhjes së orës do të kalosh automatikisht te të dhënat e tua.</p>
            <div class="schedule-picker">
              <div class="calendar-panel">
                <div class="mb-4 flex items-center justify-between gap-3"><div><p class="text-sm font-semibold">Data e vizitës</p><p class="mt-1 text-xs text-muted">Deri më {{ maximumDate }}</p></div><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" /></div>
                <UCalendar v-model="selectedDate" :min-value="calendarMinimum" :max-value="calendarMaximum" locale="sq-AL" :week-starts-on="1" :year-controls="false" size="lg" class="mx-auto w-full" :ui="{ root: 'w-full', body: 'w-full', grid: 'w-full', gridRow: 'grid grid-cols-7 place-items-center', gridWeekDaysRow: 'grid grid-cols-7', cell: 'flex justify-center', cellTrigger: 'size-9 rounded-full' }" />
              </div>
              <div class="times-panel" aria-live="polite">
                <div class="mb-4"><p class="text-sm font-semibold">Ora e fillimit</p><p class="mt-1 text-xs text-muted">{{ date ? `Për ${totalDuration} minuta shërbime` : 'Së pari zgjidh datën' }}</p></div>
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
            <UButton color="neutral" variant="ghost" type="button" class="back-button" @click="step = 3">← Ndrysho orarin</UButton>
            <h2 id="details-heading" class="mt-4 font-display text-3xl" tabindex="-1">Të dhënat e tua</h2>
            <p class="mt-2 mb-6 text-sm text-muted">Do t’i përdorim vetëm për rezervimin dhe kontaktin rreth terminit.</p>
            <UForm :schema="customerSchema" :state="customer" class="grid gap-5 sm:grid-cols-2" @submit="review">
              <UFormField label="Emri dhe mbiemri" name="fullName" required class="sm:col-span-2"><UInput v-model="customer.fullName" autocomplete="name" class="w-full" /></UFormField>
              <UFormField label="Numri i telefonit" name="phone" required><UInput v-model="customer.phone" type="tel" autocomplete="tel" placeholder="+383 44 123 456" class="w-full" /></UFormField>
              <UFormField label="Emaili (opsional)" name="email"><UInput v-model="customer.email" type="email" autocomplete="email" placeholder="emri@shembull.com" class="w-full" /></UFormField>
              <UButton type="submit" size="lg" class="w-full justify-center sm:col-span-2 sm:w-fit">Shiko përmbledhjen</UButton>
            </UForm>
          </section>

          <section v-else aria-labelledby="confirm-heading">
            <UButton color="neutral" variant="ghost" type="button" class="back-button" :disabled="submitting" @click="step = 4">← Ndrysho të dhënat</UButton>
            <h2 id="confirm-heading" class="mt-4 font-display text-3xl">Konfirmo rezervimin</h2>
            <p class="mt-2 text-sm text-muted">Kontrollo të dhënat përpara se ta dërgosh rezervimin.</p>

            <div class="confirmation-shell">
              <div class="confirmation-appointment">
                <span class="confirmation-icon"><UIcon name="i-lucide-calendar-check" /></span>
                <div class="min-w-0">
                  <p>Termini i zgjedhur</p>
                  <strong>{{ slot ? dateLabel(slot.startsAt) : '' }}</strong>
                  <span>{{ slot?.localTime }} · {{ barber?.name }}</span>
                </div>
                <UButton color="neutral" variant="ghost" type="button" :disabled="submitting" @click="step = 3">Ndrysho</UButton>
              </div>

              <div class="confirmation-grid">
                <section class="confirmation-card" aria-labelledby="confirmation-services">
                  <div class="confirmation-card-heading">
                    <span><UIcon name="i-lucide-scissors" /></span>
                    <div><h3 id="confirmation-services">Shërbimet</h3><p>{{ totalDuration }} minuta gjithsej</p></div>
                    <UButton color="neutral" variant="ghost" type="button" :disabled="submitting" @click="step = 2">Ndrysho</UButton>
                  </div>
                  <ul class="confirmation-services">
                    <li v-for="item in selectedServices" :key="item.id"><span>{{ item.name }}</span><strong>{{ money(item.price_minor) }}</strong></li>
                  </ul>
                </section>

                <section class="confirmation-card" aria-labelledby="confirmation-customer">
                  <div class="confirmation-card-heading">
                    <span><UIcon name="i-lucide-user-round" /></span>
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

            <div class="confirmation-notice"><UIcon name="i-lucide-clock-check" /><p>Ju lutemi, respektojeni orarin e rezervuar dhe paraqituni në Toli Hair 10 minuta para fillimit të terminit.</p></div>
            <UButton class="mt-5 w-full justify-center sm:w-auto" size="xl" icon="i-lucide-calendar-check" :loading="submitting" :disabled="submitting" @click="booking.confirm">Konfirmo rezervimin</UButton>
          </section>
        </div>

        <aside class="booking-summary h-fit lg:sticky lg:top-24" aria-label="Përmbledhja e zgjedhjeve">
          <div class="mb-5 flex items-center justify-between"><p class="eyebrow text-brand-300">Përmbledhja</p><UIcon name="i-lucide-receipt-text" class="size-5 text-white/40" /></div>
          <dl class="mt-4 space-y-4 text-sm">
            <div><dt>Shërbimet</dt><dd v-if="selectedServices.length" class="mt-1 space-y-1 font-medium text-white"><span v-for="item in selectedServices" :key="item.id" class="block">{{ item.name }}</span></dd><dd v-else class="mt-1 font-medium text-white/45">Pa zgjedhur</dd></div>
            <div><dt>Berberi</dt><dd class="mt-1 font-medium text-white">{{ barber?.name || 'Pa zgjedhur' }}</dd></div>
            <div><dt>Termini</dt><dd class="mt-1 font-medium text-white">{{ slot ? `${dateLabel(slot.startsAt)}, ${slot.localTime}` : 'Pa zgjedhur' }}</dd></div>
            <div v-if="selectedServices.length" class="border-t border-white/10 pt-4"><dt>Gjithsej</dt><dd class="mt-1 text-2xl font-semibold text-white">{{ money(totalPrice) }}</dd><p class="mt-1 text-xs text-white/45">{{ totalDuration }} minuta</p></div>
          </dl>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.booking-intro { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.25rem; }
.barber-grid { display: grid; gap: .85rem; }
.barber-card { display: flex; width: 100%; align-items: center; gap: 1rem; border: 1px solid var(--ui-border); border-radius: 1rem; background: white; padding: 1rem; transition: border-color .15s, box-shadow .15s, transform .15s; }
.barber-card:hover { border-color: color-mix(in srgb, var(--ui-primary) 55%, transparent); transform: translateY(-2px); box-shadow: 0 .75rem 2rem rgb(13 31 26 / .08); }
.barber-avatar { display: grid; width: 3.25rem; height: 3.25rem; flex: 0 0 auto; place-items: center; border-radius: 1rem; background: var(--color-brand-950); color: white; font-size: 1.1rem; font-weight: 800; }
.service-list { overflow: hidden; border: 1px solid var(--ui-border); border-radius: 1.15rem; background: white; }
.service-row { display: block; width: 100%; padding: 1rem; transition: background-color .15s, box-shadow .15s; }
.service-row + .service-row { border-top: 1px solid var(--ui-border); }
.service-row:hover { background: var(--ui-bg-elevated); }
.service-row-selected { position: relative; z-index: 1; background: var(--color-brand-50); box-shadow: inset .2rem 0 var(--ui-primary); }
.service-row-selected:hover { background: var(--color-brand-50); }
.service-icon { display: grid; width: 2.25rem; height: 2.25rem; flex: 0 0 auto; place-items: center; border-radius: .65rem; background: var(--ui-bg-elevated); color: var(--ui-primary); }
.choice-meta { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .9rem; border-top: 1px solid var(--ui-border); padding-top: .75rem; color: var(--ui-text-muted); font-size: .75rem; }
.choice-meta strong { color: var(--ui-text); font-size: .875rem; }
.selection-mark { display: grid; width: 1.75rem; height: 1.75rem; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-border); border-radius: .55rem; color: var(--ui-primary); font-weight: 700; }
.service-row-selected .selection-mark { border-color: var(--ui-primary); background: var(--ui-primary); color: white; }
.back-button { color: var(--ui-text-muted); font-size: .8rem; font-weight: 650; transition: color .15s; }
.back-button:hover { color: var(--ui-primary); }
.schedule-picker { display: grid; overflow: hidden; border: 1px solid var(--ui-border); border-radius: 1.25rem; background: white; box-shadow: 0 1rem 3rem rgb(13 31 26 / .055); }
.calendar-panel, .times-panel { min-width: 0; padding: clamp(1rem, 3vw, 1.5rem); }
.times-panel { border-top: 1px solid var(--ui-border); background: #f5f7f4; }
.time-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
.slot-button { justify-content: center; min-height: 2.75rem; border: 1px solid var(--ui-border); border-radius: .7rem; background: white; font-size: .875rem; font-weight: 700; transition: border-color .15s, background .15s, color .15s, transform .15s; }
.slot-button:hover { border-color: var(--ui-primary); transform: translateY(-1px); }
.slot-selected, .slot-selected:hover { border-color: var(--ui-primary); background: var(--ui-primary); color: white; box-shadow: 0 .35rem 1rem color-mix(in srgb, var(--ui-primary) 25%, transparent); }
.confirmation-shell { margin-top: 1.5rem; overflow: hidden; border: 1px solid var(--ui-border); border-radius: .75rem; background: white; box-shadow: 0 1rem 2.5rem rgb(13 31 26 / .06); }
.confirmation-appointment { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; background: #12241d; padding: 1.25rem; color: white; }
.confirmation-icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border: 1px solid rgb(255 255 255 / .14); border-radius: .5rem; background: rgb(255 255 255 / .08); color: #86c4aa; }
.confirmation-icon svg { width: 1.25rem; height: 1.25rem; }
.confirmation-appointment p { color: rgb(255 255 255 / .52); font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.confirmation-appointment strong, .confirmation-appointment span { display: block; }
.confirmation-appointment strong { margin-top: .2rem; overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
.confirmation-appointment div > span { margin-top: .15rem; color: rgb(255 255 255 / .62); font-size: .8rem; }
.confirmation-appointment button, .confirmation-card-heading button { color: var(--ui-primary); font-size: .75rem; font-weight: 700; }
.confirmation-appointment button { color: #a9d7c3; }
.confirmation-appointment button:hover, .confirmation-card-heading button:hover { text-decoration: underline; text-underline-offset: .2rem; }
.confirmation-grid { display: grid; }
.confirmation-card { min-width: 0; padding: 1.25rem; }
.confirmation-card + .confirmation-card { border-top: 1px solid var(--ui-border); }
.confirmation-card-heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .75rem; }
.confirmation-card-heading > span { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: .45rem; background: var(--color-brand-50); color: var(--ui-primary); }
.confirmation-card-heading svg { width: 1rem; height: 1rem; }
.confirmation-card-heading h3 { font-size: .9rem; font-weight: 750; }
.confirmation-card-heading p { margin-top: .1rem; color: var(--ui-text-muted); font-size: .7rem; }
.confirmation-services, .confirmation-customer { margin-top: 1rem; border-top: 1px solid var(--ui-border); padding-top: .75rem; }
.confirmation-services li, .confirmation-customer > div { display: flex; min-width: 0; justify-content: space-between; gap: 1rem; padding-block: .35rem; font-size: .82rem; }
.confirmation-services span, .confirmation-customer dd { min-width: 0; overflow-wrap: anywhere; }
.confirmation-services strong { white-space: nowrap; }
.confirmation-customer dt { flex: 0 0 auto; color: var(--ui-text-muted); }
.confirmation-customer dd { text-align: right; font-weight: 600; }
.confirmation-total { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--ui-border); background: var(--ui-bg-elevated); padding: 1rem 1.25rem; }
.confirmation-total span, .confirmation-total small { display: block; }
.confirmation-total span { font-size: .82rem; font-weight: 700; }
.confirmation-total small { margin-top: .15rem; color: var(--ui-text-muted); font-size: .7rem; }
.confirmation-total > strong { color: var(--ui-primary); font-size: 1.5rem; letter-spacing: -.03em; }
.confirmation-notice { display: flex; align-items: flex-start; gap: .65rem; margin-top: 1rem; color: var(--ui-text-muted); font-size: .72rem; line-height: 1.6; }
.confirmation-notice svg { width: 1rem; height: 1rem; margin-top: .15rem; flex: 0 0 auto; color: var(--ui-primary); }
.summary-row { display: grid; grid-template-columns: minmax(7rem, .7fr) minmax(0, 1.3fr); gap: 1rem; padding-block: 1rem; }
.summary-row dt { color: var(--ui-text-muted); }
.summary-row dd { text-align: right; font-weight: 500; }
.booking-embedded { border: 1px solid var(--ui-border); border-radius: 1.75rem; background: rgb(255 255 255 / .94); padding: clamp(1.25rem, 3vw, 2rem); box-shadow: 0 1.5rem 4rem rgb(13 31 26 / .09); backdrop-filter: blur(1rem); }
.booking-summary { display: none; border-radius: 1.25rem; background: #12241d; padding: 1.4rem; color: white; box-shadow: 0 1rem 2.5rem rgb(13 31 26 / .14); }
.booking-summary dt { color: rgb(255 255 255 / .46); }
@media (min-width: 700px) { .schedule-picker { grid-template-columns: minmax(20rem, 1.08fr) minmax(17rem, .92fr); } .times-panel { border-top: 0; border-left: 1px solid var(--ui-border); } }
@media (min-width: 640px) { .barber-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .service-row { padding: 1.15rem 1.25rem; } }
@media (min-width: 760px) { .confirmation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .confirmation-card + .confirmation-card { border-top: 0; border-left: 1px solid var(--ui-border); } }
@media (min-width: 1024px) { .booking-summary { display: block; } }
@media (max-width: 639px) {
  .booking-intro { margin-bottom: .85rem; }
  .booking-embedded { border-radius: 1.25rem; padding: 1rem; }
  .schedule-picker { border-radius: 1rem; }
  .calendar-panel, .times-panel { padding: 1rem; }
  .back-button { display: inline-flex; min-height: 2.75rem; align-items: center; }
  .summary-row { grid-template-columns: 1fr; gap: .35rem; }
  .summary-row dd { text-align: left; }
  .confirmation-appointment { gap: .75rem; padding: 1rem; }
  .confirmation-appointment strong { white-space: normal; }
  .confirmation-card { padding: 1rem; }
  .confirmation-total { padding-inline: 1rem; }
  .booking-actions { position: sticky; bottom: .75rem; z-index: 10; background: rgb(241 243 239 / .94); box-shadow: 0 1rem 2.5rem rgb(13 31 26 / .14); backdrop-filter: blur(1rem); }
}
@media (max-width: 359px) {
  .booking-embedded { padding: .75rem; }
  .calendar-panel, .times-panel { padding: .75rem; }
  .time-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
