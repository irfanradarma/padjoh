/**
 * One-time script: reset all student passwords to a master password.
 * Run: node scripts/reset-passwords.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://cdypfbswmzwvfjoqzykh.supabase.co'
const SERVICE_ROLE_KEY = 'xxxxx'
const NEW_PASSWORD     = 'PKNstan2025!'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: profiles, error: pErr } = await admin
  .from('profiles')
  .select('id, npm, name')
  .eq('is_admin', false)

if (pErr) { console.error('Failed to fetch profiles:', pErr.message); process.exit(1) }
console.log(`Found ${profiles.length} student profiles.\n`)

let ok = 0, fail = 0
for (const p of profiles) {
  const { error } = await admin.rpc('admin_reset_password', {
    p_user_id: p.id,
    p_password: NEW_PASSWORD,
  })
  if (error) {
    console.log(`  FAIL  ${p.npm}  ${p.name ?? ''} — ${error.message}`)
    fail++
  } else {
    console.log(`  ✓     ${p.npm}  ${p.name ?? ''}`)
    ok++
  }
}

console.log(`\nDone: ${ok} updated, ${fail} failed.`)
