import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { AppointmentData, AppointmentRecord } from '#shared/types/appointments'
import type { AppointmentMutation, AppointmentQuery, StaffAvailabilityQuery } from '#shared/schemas/appointments'

export async function loadAppointments(client: SupabaseClient<Database>, query: AppointmentQuery): Promise<AppointmentData> {
  const results = await Promise.all([
    client.rpc('get_staff_appointments', {
      p_from: query.from,
      p_to: query.to,
      ...(query.barberId ? { p_barber: query.barberId } : {}),
      ...(query.status ? { p_status: query.status } : {}),
      ...(query.query ? { p_query: query.query } : {}),
    }),
    client.from('barbers').select('id,revision,name,bio,is_active').order('sort_order').order('name'),
    client.from('services').select('id,revision,name,description,duration_minutes,price_minor,is_active').order('sort_order').order('name'),
    client.from('barber_services').select('barber_id,service_id'),
    client.from('shop_settings').select('timezone,currency').eq('id', true).single(),
  ] as const)
  for (const result of results.slice(1)) if (result.error) appointmentError(result.error)

  const timezone = results[4].data?.timezone || 'Europe/Belgrade'
  let appointments: AppointmentRecord[]
  if (!results[0].error) {
    appointments = (results[0].data || []) as AppointmentRecord[]
  }
  else if (results[0].error.code === 'PGRST202') {
    // Older installations may not have the staff-list RPC yet. The request has
    // already passed requireStaff(), and the direct select remains protected by
    // the appointments staff_read RLS policy.
    appointments = await loadAppointmentsDirect(client, query, timezone)
  }
  else {
    appointmentError(results[0].error)
  }

  return {
    appointments,
    barbers: results[1].data || [],
    services: results[2].data || [],
    assignments: results[3].data || [],
    timezone,
    currency: results[4].data?.currency || 'EUR',
  }
}

function shiftedUtcBoundary(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function localDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function loadAppointmentsDirect(client: SupabaseClient<Database>, query: AppointmentQuery, timezone: string) {
  let request = client.from('appointments')
    .select('id,version,barber_id,service_id,customer_name,customer_phone,customer_email,starts_at,ends_at,status,service_name,duration_minutes,price_minor,currency,source,created_at')
    // One padded day on either side keeps local-midnight filtering correct
    // through CET/CEST changes without assuming a fixed UTC offset.
    .gte('starts_at', shiftedUtcBoundary(query.from, -1))
    .lt('starts_at', shiftedUtcBoundary(query.to, 1))
    .order('starts_at')
    .order('created_at')
    .limit(1000)

  if (query.barberId) request = request.eq('barber_id', query.barberId)
  if (query.status) request = request.eq('status', query.status)

  const result = await request
  if (result.error) appointmentError(result.error)
  const search = query.query?.toLocaleLowerCase('sq')

  return (result.data || []).filter((item) => {
    const day = localDate(item.starts_at, timezone)
    if (day < query.from || day >= query.to) return false
    if (!search) return true
    return [item.customer_name, item.customer_phone, item.customer_email || '']
      .some(value => value.toLocaleLowerCase('sq').includes(search))
  }) as AppointmentRecord[]
}

export async function loadStaffAvailability(client: SupabaseClient<Database>, query: StaffAvailabilityQuery) {
  const result = await client.rpc('get_staff_available_slots', {
    p_service: query.serviceId,
    p_date: query.date,
    ...(query.barberId ? { p_barber: query.barberId } : {}),
    ...(query.appointmentId ? { p_exclude_appointment: query.appointmentId } : {}),
  })
  if (result.error) appointmentError(result.error)
  return { slots: (result.data || []).map(slot => ({ startsAt: slot.slot_start, localTime: slot.local_time, barberId: slot.barber_id, barberName: slot.barber_name })) }
}

export async function saveAppointment(client: SupabaseClient<Database>, input: AppointmentMutation) {
  let result
  if (input.action === 'create') {
    result = await client.rpc('create_staff_appointment', {
      p_key: input.idempotencyKey, p_barber: input.barberId, p_service: input.serviceId,
      p_start: input.startsAt, p_name: input.customer.fullName,
      p_phone: input.customer.phone, p_email: input.customer.email,
    })
  }
  else if (input.action === 'update') {
    result = await client.rpc('update_staff_appointment', {
      p_id: input.id, p_version: input.version, p_barber: input.barberId,
      p_service: input.serviceId, p_start: input.startsAt,
      p_name: input.customer.fullName, p_phone: input.customer.phone, p_email: input.customer.email,
    })
  }
  else {
    result = await client.rpc('set_appointment_status', { p_id: input.id, p_version: input.version, p_status: input.status })
  }
  if (result.error) appointmentError(result.error)
  return { appointment: result.data as AppointmentRecord }
}
