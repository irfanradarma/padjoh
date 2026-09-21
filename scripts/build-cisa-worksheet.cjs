const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'docs/cisa-domain-4-5-case-quiz.source.local.html')
const outputPath = path.join(root, 'docs/cisa-domain-4-5-case-quiz.html')
const envPath = path.join(root, '.env.cisa-worksheet.local')
const source = fs.readFileSync(sourcePath, 'utf8')
const secrets = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
  const at = line.indexOf('=')
  return [line.slice(0, at), line.slice(at + 1)]
}))

function extractPackage(round) {
  const marker = `<section class="round${round === 1 ? ' active' : ''}" id="round-${round}">`
  const start = source.indexOf(marker)
  assert.ok(start !== -1, `Package ${round} found`)
  const end = round === 1 ? source.indexOf('<section class="round" id="round-2">', start) : source.indexOf('\n  </div>\n  <p class="hint">', start)
  assert.ok(end > start, `Package ${round} boundary found`)
  return { start, end, html: source.slice(start, end).trim() }
}

function encrypt(round, html) {
  const password = secrets[`CISA_CASE_PASSWORD_${round}`]
  assert.match(password || '', /^\S+$/, `Package ${round} password is one word`)
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const iterations = 310000
  const key = crypto.pbkdf2Sync(password.normalize('NFKC').toLocaleLowerCase('id-ID'), salt, iterations, 32, 'sha256')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(`cisa-d4d5-quiz/v1:${round}`))
  const ciphertext = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return { iterations, salt: salt.toString('base64url'), iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url') }
}

const first = extractPackage(1)
const second = extractPackage(2)
const packages = { 1: encrypt(1, first.html), 2: encrypt(2, second.html) }
let output = source.slice(0, first.start) + source.slice(second.end)
output = output.replace('const ENCRYPTED_PACKAGES = /* injected by build-cisa-worksheet.cjs */ null;', `const ENCRYPTED_PACKAGES = ${JSON.stringify(packages)};`)
output = output.replace(/(<div id="questions-container" hidden>)\s*(<\/div>)/, '$1$2')
assert.ok(!output.includes('Narasi kasus') && !output.includes('Berkas bukti') && !output.includes('r1-d4'), 'Plaintext questions removed')
fs.writeFileSync(outputPath, output)
console.log(`Encrypted worksheet built: ${outputPath}`)
