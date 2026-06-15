/**
 * One-time script: reset all student passwords to a master password.
 *
 * HOW TO RUN:
 *   1. Get your service role key from:
 *      Supabase Dashboard → Project Settings → API → service_role (secret key)
 *   2. Paste it below as SERVICE_ROLE_KEY
 *   3. In your terminal: node scripts/reset-passwords.mjs
 *
 * The service role key is never sent to the browser — safe to paste here temporarily.
 * Delete or gitignore this file after use.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://cdypfbswmzwvfjoqzykh.supabase.co'
const SERVICE_ROLE_KEY = 'PASTE_SERVICE_ROLE_KEY_HERE'
const NEW_PASSWORD     = 'PKNstan2025!'

// ─────────────────────────────────────────────────────────────────────────────

if (SERVICE_ROLE_KEY === 'PASTE_SERVICE_ROLE_KEY_HERE') {
  console.error('❌  Fill in SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1. Fetch all student NPMs from whitelist
const { data: students, error: wErr } = await admin
  .from('npm_whitelist')
  .select('npm, full_name')
  .neq('class', 'admin')

if (wErr) { console.error('Failed to fetch whitelist:', wErr.message); process.exit(1) }
console.log(`Found ${students.length} students in whitelist.\n`)

// 2. Fetch all auth users (handles pagination)
let allUsers = []
let page = 1
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) { console.error('Failed to list users:', error.message); process.exit(1) }
  allUsers = allUsers.concat(data.users)
  if (data.users.length < 1000) break
  page++
}

const emailToId = Object.fromEntries(allUsers.map(u => [u.email, u.id]))

// 3. Reset each student's password
let ok = 0, skip = 0, fail = 0

for (const { npm, full_name } of students) {
  const email = `${npm}@npm.app`
  const uid   = emailToId[email]

  if (!uid) {
    console.log(`  SKIP  ${npm}  ${full_name} — no auth account`)
    skip++
    continue
  }

  const { error } = await admin.auth.admin.updateUserById(uid, { password: NEW_PASSWORD })

  if (error) {
    console.log(`  FAIL  ${npm}  ${full_name} — ${error.message}`)
    fail++
  } else {
    console.log(`  ✓     ${npm}  ${full_name}`)
    ok++
  }
}

console.log(`\nDone: ${ok} updated, ${skip} skipped (no account), ${fail} failed.`)
