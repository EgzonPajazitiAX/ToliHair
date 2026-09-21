export interface ServiceRecord { id: string, revision: number, name: string, description: string, duration_minutes: number, price_minor: number, is_active: boolean }
export interface BarberRecord { id: string, revision: number, name: string, bio: string, is_active: boolean }
export interface HoursRecord { id: string, barber_id: string, weekday: number, start_time: string, end_time: string }
export interface BlockRecord { id: string, revision: number, barber_id: string, starts_at: string, ends_at: string, reason: string }
export interface SettingsRecord { revision: number, name: string, phone: string | null, address: string | null, timezone: string | null, currency: string | null, slot_interval_minutes: number, minimum_notice_minutes: number, booking_horizon_days: number, booking_enabled: boolean }
export interface ManagementData { services: ServiceRecord[], barbers: BarberRecord[], assignments: { barber_id: string, service_id: string }[], hours: HoursRecord[], blocks: BlockRecord[], settings: SettingsRecord }
