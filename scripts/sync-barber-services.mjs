import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_SECRET_KEY is missing.')
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const [services, barbers] = await Promise.all([
  client.from('services').select('id'),
  client.from('barbers').select('id'),
])
if (services.error || barbers.error) {
  console.error('Could not load services and barbers.')
  process.exit(1)
}

const pairs = barbers.data.flatMap(barber => services.data.map(service => ({ barber_id: barber.id, service_id: service.id })))
for (let index = 0; index < pairs.length; index += 500) {
  const { error } = await client.from('barber_services').upsert(pairs.slice(index, index + 500), {
    onConflict: 'barber_id,service_id',
    ignoreDuplicates: true,
  })
  if (error) {
    console.error('Could not synchronize barber services.')
    process.exit(1)
  }
}
console.log(`Synchronized ${pairs.length} barber-service assignments.`)
