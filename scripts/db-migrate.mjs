import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { databaseTls } from './db-tls.mjs'

// SQL credentials stay in the process environment; never log errors containing URLs.
const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is missing. Add the PostgreSQL connection string to .env; a publishable API key cannot run migrations.')
  process.exit(1)
}
const target = new URL(url)
if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw new Error('Expected a PostgreSQL connection URL')
const client = new pg.Client({ connectionString: url, ssl: databaseTls(target.hostname), connectionTimeoutMillis: 15000 })
try {
  await client.connect()
  await client.query('begin')
  await client.query("set local lock_timeout = '15s'")
  await client.query('select pg_advisory_xact_lock(714209, 2)')
  await client.query('create schema if not exists supabase_migrations')
  await client.query('create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)')
  const applied = new Set((await client.query('select version from supabase_migrations.schema_migrations')).rows.map(row => row.version))
  const folder = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(folder)).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
    const [version] = file.split('_')
    if (applied.has(version)) { console.log(`${file}: already applied`); continue }
    const sql = await readFile(new URL(file, folder), 'utf8')
    await client.query(sql)
    await client.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)', [version, [sql], file.slice(version.length + 1, -4)])
    console.log(`${file}: prepared (${createHash('sha256').update(sql).digest('hex').slice(0, 12)})`)
  }
  await client.query('commit')
  console.log('Database migrations committed successfully.')
}
catch (error) {
  await client.query('rollback').catch(() => {})
  console.error(`Migration failed; transaction rolled back. Code: ${error.code || 'connection/configuration'}. No credentials logged.`)
  process.exitCode = 1
}
finally { await client.end() }
