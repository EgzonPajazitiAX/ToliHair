import { readFileSync } from 'node:fs'
import { rootCertificates } from 'node:tls'

// Public CA downloaded from the URL used by the official Supabase Studio:
// https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
export function databaseTls(hostname) {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return false
  return {
    rejectUnauthorized: true,
    ca: [...rootCertificates, readFileSync(new URL('../supabase/certs/prod-ca-2021.crt', import.meta.url), 'utf8')],
  }
}
