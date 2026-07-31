import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bbihagodremxsrktxhlw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_znbJC4o0n5VbaOWeAOkW3w_xcoucYcF'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
