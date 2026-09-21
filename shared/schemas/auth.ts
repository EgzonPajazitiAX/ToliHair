import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().max(254, 'Adresa e emailit është shumë e gjatë').pipe(z.email('Shkruani një adresë të vlefshme emaili')),
  password: z.string().min(1, 'Shkruani fjalëkalimin').max(256, 'Fjalëkalimi është shumë i gjatë'),
}).strict()
