import { z } from 'zod'

// Format validation only. Phone normalization and booking rules come with the API.
export const customerSchema = z.object({
  fullName: z.string().trim().min(2, 'Shkruani emrin dhe mbiemrin').max(120, 'Emri është shumë i gjatë'),
  phone: z.string().trim().min(6, 'Shkruani numrin e telefonit').max(30, 'Numri i telefonit është shumë i gjatë')
    .regex(/^\+?[0-9 ()-]+$/, 'Shkruani një numër telefoni të vlefshëm'),
  email: z.preprocess(
    value => typeof value === 'string' ? value.trim() || undefined : value,
    z.email('Shkruani një adresë të vlefshme emaili').max(254, 'Adresa e emailit është shumë e gjatë').optional(),
  ),
})

export type CustomerInput = z.infer<typeof customerSchema>
