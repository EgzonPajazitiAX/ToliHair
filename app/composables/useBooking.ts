import type { AvailabilitySlot, BookingCatalog, BookingReceipt } from '#shared/types/booking'

function dateInZone(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function failureMessage(error: unknown, fallback: string) {
  const failure = error as { data?: { statusMessage?: string }, statusMessage?: string }
  return failure.data?.statusMessage || failure.statusMessage || fallback
}

export function useBooking() {
  const catalogRequest = useFetch<BookingCatalog>('/api/booking/catalog', { key: 'booking-catalog' })
  const step = ref(1)
  const serviceIds = ref<string[]>([])
  const barberId = ref('')
  const date = ref('')
  const slot = ref<AvailabilitySlot | null>(null)
  const slots = ref<AvailabilitySlot[]>([])
  const loadingSlots = ref(false)
  let availabilityRequest = 0
  watch([serviceIds, barberId, date], () => { availabilityRequest++; loadingSlots.value = false }, { flush: 'sync' })
  onScopeDispose(() => { availabilityRequest++ })
  const submitting = ref(false)
  const message = ref('')
  const idempotencyKey = ref('')
  const customer = reactive({ fullName: '', phone: '', email: '' })

  const catalog = computed(() => catalogRequest.data.value)
  const barbers = computed(() => catalog.value?.barbers || [])
  const selectedBarber = computed(() => catalog.value?.barbers.find(item => item.id === barberId.value))
  const availableServices = computed(() => selectedBarber.value
    ? catalog.value?.services.filter(item => selectedBarber.value!.service_ids.includes(item.id)) || []
    : [])
  const selectedServices = computed(() => catalog.value?.services.filter(item => serviceIds.value.includes(item.id)) || [])
  const totalDuration = computed(() => selectedServices.value.reduce((total, item) => total + item.duration_minutes, 0))
  const totalPrice = computed(() => selectedServices.value.reduce((total, item) => total + item.price_minor, 0))
  const barber = selectedBarber
  const timezone = computed(() => catalog.value?.shop.timezone || 'Europe/Belgrade')
  const minimumDate = computed(() => dateInZone(timezone.value))
  const maximumDate = computed(() => addDays(minimumDate.value, catalog.value?.shop.booking_horizon_days || 60))

  watch([serviceIds, barberId, date, () => slot.value?.startsAt, () => customer.fullName, () => customer.phone, () => customer.email], () => { idempotencyKey.value = '' }, { flush: 'sync' })

  function toggleService(id: string) {
    if (!barber.value?.service_ids.includes(id)) return
    const selected = serviceIds.value.includes(id)
      ? serviceIds.value.filter(serviceId => serviceId !== id)
      : [...serviceIds.value, id]
    const duration = catalog.value?.services.filter(item => selected.includes(item.id)).reduce((total, item) => total + item.duration_minutes, 0) || 0
    if (selected.length > 10 || duration > 480) {
      message.value = 'Kombinimi i shërbimeve nuk mund të jetë më i gjatë se 8 orë.'
      return
    }
    serviceIds.value = selected
    date.value = ''; slot.value = null; slots.value = []; message.value = ''
  }

  function continueFromServices() {
    if (!barber.value) { message.value = 'Zgjidhni së pari berberin.'; step.value = 1; return }
    if (!serviceIds.value.length) { message.value = 'Zgjidhni së paku një shërbim.'; return }
    step.value = 3
  }

  function chooseBarber(id: string) {
    if (!barbers.value.some(item => item.id === id)) return
    barberId.value = id; serviceIds.value = []; date.value = ''; slot.value = null; slots.value = []; message.value = ''; step.value = 2
  }

  async function loadSlots() {
    const requestId = ++availabilityRequest
    slot.value = null; slots.value = []; message.value = ''
    if (!serviceIds.value.length || !barberId.value || !date.value) return
    loadingSlots.value = true
    try {
      const result = await $fetch<{ slots: AvailabilitySlot[] }>('/api/booking/availability', { query: { serviceIds: serviceIds.value.join(','), barberId: barberId.value, date: date.value } })
      if (requestId === availabilityRequest) slots.value = result.slots
    }
    catch (error) { if (requestId === availabilityRequest) message.value = failureMessage(error, 'Oraret nuk mund të ngarkoheshin. Ju lutemi provoni përsëri.') }
    finally { if (requestId === availabilityRequest) loadingSlots.value = false }
  }

  async function confirm() {
    if (!selectedServices.value.length || !barber.value || !slot.value || submitting.value) return
    submitting.value = true; message.value = ''
    try {
      if (!idempotencyKey.value) idempotencyKey.value = createIdempotencyKey()
      const result = await $fetch<{ receipt: BookingReceipt }>('/api/booking', {
        method: 'POST', headers: { 'x-toli-request': '1' },
        timeout: 20_000,
        body: { idempotencyKey: idempotencyKey.value, serviceIds: serviceIds.value, barberId: barberId.value, startsAt: slot.value.startsAt, customer },
      })
      const receipt = useState<BookingReceipt | null>('booking-receipt', () => null)
      receipt.value = result.receipt
      try { sessionStorage.setItem('toli-booking-receipt', result.receipt.token) }
      catch { /* The in-memory receipt still confirms a successful booking. */ }
      await navigateTo('/booking/success')
    }
    catch (error: unknown) {
      const status = (error as { statusCode?: number, response?: { status?: number } }).statusCode || (error as { response?: { status?: number } }).response?.status
      const errorMessage = failureMessage(error, 'Rezervimi nuk mund të përfundonte. Ju lutemi provoni përsëri.')
      if (status === 409) {
        idempotencyKey.value = ''
        await loadSlots()
        message.value = errorMessage
        step.value = 3
      }
      else message.value = errorMessage
    }
    finally { submitting.value = false }
  }

  return { ...catalogRequest, catalog, step, serviceIds, barberId, date, slot, slots, loadingSlots, submitting, message, customer, availableServices, selectedServices, totalDuration, totalPrice, barbers, barber, timezone, minimumDate, maximumDate, toggleService, continueFromServices, chooseBarber, loadSlots, confirm }
}
