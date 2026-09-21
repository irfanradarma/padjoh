import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY
const npm = process.env.CISA_TEST_NPM || '4213250008'
const teammateNpm = process.env.CISA_TEST_TEAMMATE_NPM || '4213250005'
if (!url || !serviceKey || !anonKey) throw new Error('Supabase URL, service key, and anon key are required.')

const publicJwk = {
  kty: 'RSA',
  n: 'wWLLYjj2KaOrSeg2VxpBATyFM6_wBHsTDnDG-9RbHtR35BXZaSwbgtEz5D90mnljjlKLjJsLSwe_cv4KlvW0qrwjP6JEnLxbasfc_-GUAl2BKlqlHoRUTXINBjlaR_YQzQQzhgTrIcTxxDsh9N6XEB3B_H5LmVoAQAjMLCoGPBingyE73SdpkjuMLL888NO1w8LGmqQg5cOnFrtM8uCJY566JESdmhaeeI_MdLnKYa_haSFCY84wcWaLp23ae34Xu3eHGVLzkFFI8LKaGHBlbDjE61W723vp3jA6pvNLzzsDWBd_6xZ0aft1K8WNGxbv1AGFTbbMqPjsttCA6uS9GQ',
  e: 'AQAB',
  alg: 'RSA-OAEP-256',
  ext: true,
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const { data: profiles, error: profileError } = await admin.from('profiles').select('id,npm,class').in('npm', [npm, teammateNpm])
if (profileError || profiles?.length !== 2) throw profileError || new Error('Test team profiles not found.')
const student = profiles.find(profile => profile.npm === npm)
const { data: userData, error: userError } = await admin.auth.admin.getUserById(student.id)
if (userError || !userData.user?.email) throw userError || new Error('Student auth account has no email.')
const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: userData.user.email })
if (linkError) throw linkError
const studentClient = createClient(url, anonKey, { auth: { persistSession: false } })
const { data: sessionData, error: verifyError } = await studentClient.auth.verifyOtp({
  type: 'magiclink',
  token_hash: linkData.properties.hashed_token,
})
if (verifyError || !sessionData.session?.access_token) throw verifyError || new Error('Could not create student test session.')
const accessToken = sessionData.session.access_token

async function invoke(body) {
  const response = await fetch(`${url}/functions/v1/cisa-case-submission`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Function returned ${response.status}.`)
  return result
}

function base64url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

async function encrypt(payload) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const rawKey = await crypto.subtle.exportKey('raw', aesKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(JSON.stringify(payload)))
  const rsaKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, rawKey)
  return {
    format: 'cisa-d4d5-encrypted/v1',
    alg: 'RSA-OAEP-256+A256GCM',
    key_id: 'cisa-d4d5-2026-01',
    iv: base64url(iv),
    wrapped_key: base64url(wrappedKey),
    ciphertext: base64url(ciphertext),
  }
}

const answers = Object.fromEntries(['d4', 'd5'].flatMap(domain =>
  Array.from({ length: 8 }, (_, index) => [`r2-${domain}-q${String(index + 1).padStart(2, '0')}`, `LIVE TEST ${domain.toUpperCase()} ${index + 1}`])))
const envelope = await encrypt({
  schema: 'cisa-d4d5-workpaper/v1',
  round: 2,
  class: student.class,
  members: [{ npm }, { npm: teammateNpm }],
  answers,
  exported_at: new Date().toISOString(),
})

let insertedId
try {
  const submitted = await invoke({ action: 'submit', envelope })
  insertedId = submitted.id
  const listed = await invoke({ action: 'list' })
  const row = listed.submissions.find(item => item.id === insertedId)
  if (!row || Object.keys(row.answers || {}).length !== 16) throw new Error('Uploaded submission is not visible to the student.')
  process.stdout.write(JSON.stringify({ upload: 'passed', list: 'passed', members: row.members.length, answers: 16 }))
} finally {
  if (insertedId) {
    const { error } = await admin.from('cisa_case_submissions').delete().eq('id', insertedId)
    if (error) throw error
  }
}
