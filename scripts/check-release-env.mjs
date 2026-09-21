function fail(message) {
  console.error(`Konfigurimi i publikimit nuk është gati: ${message}`)
  process.exitCode = 1
}

function parseUrl(value, name, protocols) {
  if (!value) { fail(`${name} mungon.`); return null }
  try {
    const parsed = new URL(value)
    if (!protocols.includes(parsed.protocol)) fail(`${name} përdor protokoll të pavlefshëm.`)
    return parsed
  }
  catch { fail(`${name} nuk është URL e vlefshme.`); return null }
}

function jwtRole(key) {
  try { return JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role }
  catch { return null }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
const publicKey = process.env.SUPABASE_KEY || process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.NUXT_SUPABASE_SECRET_KEY
const appOrigin = process.env.APP_ORIGIN || process.env.NUXT_APP_ORIGIN
const databaseUrl = process.env.SUPABASE_DB_URL

const api = parseUrl(supabaseUrl, 'SUPABASE_URL', ['https:', 'http:'])
const origin = parseUrl(appOrigin, 'APP_ORIGIN', ['https:'])
const database = parseUrl(databaseUrl, 'SUPABASE_DB_URL', ['postgres:', 'postgresql:'])

if (origin && (origin.pathname !== '/' || origin.search || origin.hash)) fail('APP_ORIGIN duhet të përmbajë vetëm origin-in, pa path, query ose fragment.')
if (!publicKey) fail('SUPABASE_KEY mungon.')
else if (!publicKey.startsWith('sb_publishable_') && jwtRole(publicKey) !== 'anon') fail('SUPABASE_KEY nuk është çelës publik/anon.')
if (!secretKey) fail('SUPABASE_SECRET_KEY mungon.')
else if (!secretKey.startsWith('sb_secret_') && jwtRole(secretKey) !== 'service_role') fail('SUPABASE_SECRET_KEY nuk është çelës privat/service_role.')
if (publicKey && secretKey && publicKey === secretKey) fail('Çelësi publik dhe ai privat nuk mund të jenë të njëjtë.')
if (database && (!database.username || !database.password)) fail('SUPABASE_DB_URL duhet të përmbajë përdoruesin dhe fjalëkalimin.')
if (databaseUrl && /YOUR-PASSWORD|\[[^\]]*PASSWORD[^\]]*\]/i.test(databaseUrl)) fail('SUPABASE_DB_URL ende përmban placeholder-in e fjalëkalimit.')

if (api && database) {
  const project = api.hostname.split('.')[0]
  const directHost = `db.${api.hostname}`
  const poolerUser = decodeURIComponent(database.username) === `postgres.${project}`
  if (database.hostname !== directHost && !poolerUser) fail('SUPABASE_DB_URL nuk përputhet me projektin e SUPABASE_URL.')
}

if (!process.exitCode) console.log('Konfigurimi i publikimit është i plotë dhe nuk ekspozon kredenciale.')
