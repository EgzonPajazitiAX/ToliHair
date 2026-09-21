import { z } from 'zod'
import { customerSchema } from './customer'

const uuid = z.uuid('Identifikues i pavlefshëm')
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Shkruani një datë të vlefshme').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value
}, 'Shkruani një datë kalendarike të vlefshme')

const selectedServices = z.array(uuid).min(1, 'Zgjidhni së paku një shërbim').max(10, 'Mund të zgjidhni deri në 10 shërbime').refine(ids => new Set(ids).size === ids.length, 'Zgjidhni shërbime të ndryshme')

export const availabilityQuerySchema = z.object({
  serviceIds: z.string().optional(),
  serviceId: uuid.optional(),
  date: localDate,
  barberId: z.preprocess(value => value === '' ? undefined : value, uuid.optional()),
}).strict().refine(value => value.serviceIds || value.serviceId, 'Zgjidhni së paku një shërbim').transform(value => ({
  date: value.date,
  ...(value.barberId ? { barberId: value.barberId } : {}),
  serviceIds: (value.serviceIds ? value.serviceIds.split(',').filter(Boolean) : [value.serviceId!]),
})).pipe(z.object({ serviceIds: selectedServices, date: localDate, barberId: uuid.optional() }))

export const guestBookingSchema = z.object({
  idempotencyKey: uuid,
  serviceIds: selectedServices.optional(),
  serviceId: uuid.optional(),
  barberId: uuid,
  startsAt: z.iso.datetime({ offset: true, error: 'Shkruani një orë të vlefshme rezervimi' }),
  customer: customerSchema,
}).strict().refine(value => value.serviceIds?.length || value.serviceId, 'Zgjidhni së paku një shërbim').transform(value => ({
  idempotencyKey: value.idempotencyKey,
  serviceIds: value.serviceIds || [value.serviceId!],
  barberId: value.barberId,
  startsAt: value.startsAt,
  customer: value.customer,
}))

export const receiptSchema = z.object({ token: uuid }).strict()
export const bookingStatusSchema = z.object({ enabled: z.boolean(), revision: z.number().int().positive() }).strict()

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
export type GuestBookingInput = z.infer<typeof guestBookingSchema>
