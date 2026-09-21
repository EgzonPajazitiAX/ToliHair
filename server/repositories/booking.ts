import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { BookingCatalog, BookingReceipt, AvailabilitySlot } from '#shared/types/booking'
import type { AvailabilityQuery, GuestBookingInput } from '#shared/schemas/booking'

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseCatalog(value: unknown): BookingCatalog {
  if (!object(value) || !object(value.shop) || !Array.isArray(value.services) || !Array.isArray(value.barbers)) {
    throw createError({ statusCode: 503, statusMessage: 'Katalogu i rezervimeve ka format të pavlefshëm.' })
  }
  return value as unknown as BookingCatalog
}

function parseReceipt(value: unknown): BookingReceipt {
  if (!object(value) || typeof value.receipt_token !== 'string' || typeof value.appointment_id !== 'string') {
    throw createError({ statusCode: 503, statusMessage: 'Konfirmimi i rezervimit ka format të pavlefshëm.' })
  }
  return {
    token: value.receipt_token,
    appointmentId: value.appointment_id,
    customerName: String(value.customer_name),
    serviceName: String(value.service_name),
    barberId: String(value.barber_id),
    ...(typeof value.barber_name === 'string' ? { barberName: value.barber_name } : {}),
    startsAt: String(value.starts_at),
    endsAt: String(value.ends_at),
    durationMinutes: Number(value.duration_minutes),
    priceMinor: Number(value.price_minor),
    currency: String(value.currency),
    status: value.status as BookingReceipt['status'],
  }
}

export async function loadBookingCatalog(client: SupabaseClient<Database>) {
  const result = await client.rpc('get_booking_catalog')
  if (result.error) bookingError(result.error)
  return parseCatalog(result.data)
}

export async function loadAvailability(client: SupabaseClient<Database>, query: AvailabilityQuery): Promise<AvailabilitySlot[]> {
  const result = query.serviceIds.length === 1
    ? await client.rpc('get_available_slots', { p_service: query.serviceIds[0]!, p_date: query.date, ...(query.barberId ? { p_barber: query.barberId } : {}) })
    : await client.rpc('get_available_slots_multi', { p_services: query.serviceIds, p_date: query.date, ...(query.barberId ? { p_barber: query.barberId } : {}) })
  if (result.error) bookingError(result.error)
  return (result.data || []).map(slot => ({ startsAt: slot.slot_start, localTime: slot.local_time, barberId: slot.barber_id, barberName: slot.barber_name }))
}

export async function createGuestBooking(client: SupabaseClient<Database>, input: GuestBookingInput) {
  const common = {
    p_key: input.idempotencyKey, p_barber: input.barberId, p_start: input.startsAt,
    p_name: input.customer.fullName, p_phone: input.customer.phone, p_email: input.customer.email,
  }
  const result = input.serviceIds.length === 1
    ? await client.rpc('create_guest_booking', { ...common, p_service: input.serviceIds[0]! })
    : await client.rpc('create_guest_booking_multi', { ...common, p_services: input.serviceIds })
  if (result.error) bookingError(result.error)
  return parseReceipt(result.data)
}

export async function loadBookingReceipt(client: SupabaseClient<Database>, token: string) {
  const result = await client.rpc('get_guest_booking_receipt', { p_token: token })
  if (result.error) bookingError(result.error)
  if (!result.data) throw createError({ statusCode: 404, statusMessage: 'Konfirmimi i rezervimit nuk u gjet ose ka skaduar.' })
  return parseReceipt(result.data)
}

export async function setOnlineBooking(client: SupabaseClient<Database>, enabled: boolean, revision: number) {
  const result = await client.rpc('set_online_booking', { p_enabled: enabled, p_revision: revision })
  if (result.error) bookingError(result.error)
  return { success: true }
}
