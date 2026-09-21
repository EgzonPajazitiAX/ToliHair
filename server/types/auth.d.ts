import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { StaffIdentity } from '../../shared/types/auth'

declare module 'h3' {
  interface H3EventContext {
    sessionClient?: SupabaseClient<Database>
    staff?: StaffIdentity | null
  }
}
export {}
