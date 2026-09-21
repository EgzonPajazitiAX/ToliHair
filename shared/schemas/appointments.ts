import { z } from 'zod'
import { customerSchema } from './customer'

const uuid = z.uuid('Identifikues i pavlefshëm')
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datë e pavlefshme')
const status = z.enum(['confirmed', 'cancelled', 'completed', 'no_show'])
const base = z.object({
  barberId: uuid,
  serviceId: uuid,
  startsAt: z.iso.datetime({ offset: true, error: 'Ora e terminit nuk është e vlefshme' }),
  customer: customerSchema,
})

export const appointmentQuerySchema = z.object({
  from: localDate,
  to: localDate,
  barberId: z.preprocess(value => value === '' ? undefined : value, uuid.optional()),
  status: z.preprocess(value => value === '' ? undefined : value, status.optional()),
  query: z.preprocess(value => value === '' ? undefined : value, z.string().trim().max(100).optional()),
}).strict().refine(value => value.to > value.from, { message: 'Periudha nuk është e vlefshme' })

export const staffAvailabilityQuerySchema = z.object({
  serviceId: uuid,
  date: localDate,
  barberId: z.preprocess(value => value === '' ? undefined : value, uuid.optional()),
  appointmentId: z.preprocess(value => value === '' ? undefined : value, uuid.optional()),
}).strict()

export const appointmentMutationSchema = z.discriminatedUnion('action', [
  base.extend({ action: z.literal('create'), idempotencyKey: uuid }).strict(),
  base.extend({ action: z.literal('update'), id: uuid, version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('status'), id: uuid, version: z.number().int().positive(), status: z.enum(['cancelled', 'completed', 'no_show']) }).strict(),
])

export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>
export type StaffAvailabilityQuery = z.infer<typeof staffAvailabilityQuerySchema>
export type AppointmentMutation = z.infer<typeof appointmentMutationSchema>
