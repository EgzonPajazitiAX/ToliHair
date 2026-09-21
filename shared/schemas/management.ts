import { z } from 'zod'

export const managementResource = z.enum(['services', 'barbers', 'working-hours', 'blocked-times', 'settings'])
export type ManagementResource = z.infer<typeof managementResource>
const identity = { id: z.uuid().optional(), revision: z.number().int().positive().optional() }
const named = z.string().trim().min(2).max(120)
export const serviceForm = z.object({ ...identity, name: named, description: z.string().trim().max(2000), duration_minutes: z.number().int().min(5).max(480), price_minor: z.number().int().min(0).max(2147483647), is_active: z.boolean() }).strict()
export const barberForm = z.object({ ...identity, name: named, bio: z.string().trim().max(2000), is_active: z.boolean(), service_ids: z.array(z.uuid()).max(200) }).strict()
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const hoursForm = z.object({ id: z.uuid(), revision: z.number().int().positive(), intervals: z.array(z.object({ weekday: z.number().int().min(1).max(7), start_time: time, end_time: z.union([time, z.literal('24:00')]) }).strict().refine(v => v.end_time > v.start_time, 'Ora e përfundimit duhet të jetë pas orës së fillimit')).max(28) }).strict()
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
export const blockForm = z.object({ ...identity, barber_id: z.uuid(), start_local: localDate, end_local: localDate, reason: z.string().trim().max(500) }).strict().refine(v => v.end_local > v.start_local, 'Përfundimi duhet të jetë pas fillimit')
const deleteBlock = z.object({ id: z.uuid(), revision: z.number().int().positive(), action: z.literal('delete') }).strict()
export const settingsForm = z.object({ revision: z.number().int().positive(), name: named, phone: z.string().trim().max(40), address: z.string().trim().max(500), slot_interval_minutes: z.number().int().min(5).max(120), minimum_notice_minutes: z.number().int().min(0).max(10080), booking_horizon_days: z.number().int().min(1).max(365) }).strict()
export const managementSchemas = { services: serviceForm, barbers: barberForm, 'working-hours': hoursForm, 'blocked-times': z.union([blockForm, deleteBlock]), settings: settingsForm }
