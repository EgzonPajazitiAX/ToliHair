import type { AvailabilitySlot } from './booking'
import type { BarberRecord, ServiceRecord } from './management'

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface AppointmentRecord {
  id: string
  version: number
  barber_id: string
  service_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  service_name: string
  duration_minutes: number
  price_minor: number
  currency: string
  source: 'online' | 'staff'
  created_at: string
}

export interface AppointmentData {
  appointments: AppointmentRecord[]
  barbers: BarberRecord[]
  services: ServiceRecord[]
  assignments: { barber_id: string, service_id: string }[]
  timezone: string
  currency: string
}

export interface StaffAvailability { slots: AvailabilitySlot[] }
