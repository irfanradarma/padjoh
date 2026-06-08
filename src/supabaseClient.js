import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Helpful nudge if env vars weren't provided at build/dev time.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// NPMs are numbers, but Supabase Auth identifies users by email. We map an
// NPM to a synthetic email: 1234567890 -> 1234567890@npm.app
// Keep this domain identical to the one in sql/setup.sql.
export const NPM_EMAIL_DOMAIN = import.meta.env.VITE_NPM_EMAIL_DOMAIN || 'npm.app'
export const npmToEmail = (npm) => `${npm}@${NPM_EMAIL_DOMAIN}`

export const supabase = createClient(url, anonKey)
