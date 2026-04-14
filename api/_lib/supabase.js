import { createClient } from '@supabase/supabase-js'

// Server-side client — full access (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default supabase
