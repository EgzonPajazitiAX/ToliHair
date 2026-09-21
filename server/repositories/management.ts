import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../types/database.types'
import type { ManagementData } from '#shared/types/management'
import type { ManagementResource } from '#shared/schemas/management'

export async function loadManagement(client: SupabaseClient<Database>): Promise<ManagementData> {
  // Explicit projections keep profiles/customer details out of configuration APIs.
  const results = await Promise.all([
    client.from('services').select('id,revision,name,description,duration_minutes,price_minor,is_active').order('sort_order').order('name'),
    client.from('barbers').select('id,revision,name,bio,is_active').order('sort_order').order('name'),
    client.from('barber_services').select('barber_id,service_id'),
    client.from('working_hours').select('id,barber_id,weekday,start_time,end_time').order('weekday').order('start_time'),
    client.from('blocked_times').select('id,revision,barber_id,starts_at,ends_at,reason').order('starts_at'),
    client.from('shop_settings').select('revision,name,phone,address,timezone,currency,slot_interval_minutes,minimum_notice_minutes,booking_horizon_days,booking_enabled').eq('id', true).single(),
  ] as const)
  for (const result of results) if (result.error) managementError(result.error)
  return { services: results[0].data!, barbers: results[1].data!, assignments: results[2].data!, hours: results[3].data!, blocks: results[4].data!, settings: results[5].data! }
}

export async function saveManagement(client: SupabaseClient<Database>, resource: ManagementResource, data: Json) {
  const payload = resource === 'settings' && data && typeof data === 'object' && !Array.isArray(data)
    ? { ...data, timezone: 'Europe/Belgrade', currency: 'EUR' }
    : data
  const result = await client.rpc('manage_shop', { p_resource: resource, p_data: payload })
  if (result.error) managementError(result.error)
  return { success: true }
}

export async function synchronizeUniversalBarberServices(client: SupabaseClient<Database>) {
  const [services, barbers] = await Promise.all([
    client.from('services').select('id'),
    client.from('barbers').select('id'),
  ])
  if (services.error) managementError(services.error)
  if (barbers.error) managementError(barbers.error)

  const pairs = (barbers.data || []).flatMap(barber =>
    (services.data || []).map(service => ({ barber_id: barber.id, service_id: service.id })),
  )
  for (let index = 0; index < pairs.length; index += 500) {
    const result = await client.from('barber_services').upsert(pairs.slice(index, index + 500), { onConflict: 'barber_id,service_id', ignoreDuplicates: true })
    if (result.error) managementError(result.error)
  }
}
