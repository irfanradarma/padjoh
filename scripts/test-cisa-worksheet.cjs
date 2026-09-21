const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'docs/cisa-domain-4-5-case-quiz.html'), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script, 'Worksheet script exists')
new vm.Script(script)

function constant(name) {
  const expression = html.match(new RegExp(`const ${name} = ([^;]+);`))?.[1]
  assert.ok(expression, `${name} exists`)
  return vm.runInNewContext(`(${expression})`)
}

function base64url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

async function main() {
  const packages = constant('ENCRYPTED_PACKAGES')
  const passwords = ['cendrawasih', 'perpustakaan']
  const decryptedPackages = {}
  for (const [index, password] of passwords.entries()) {
    const round = index + 1
    const item = packages[round]
    const keyMaterial = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
    const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(item.salt, 'base64url'), iterations: item.iterations, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(item.iv, 'base64url'), additionalData: new TextEncoder().encode(`cisa-d4d5-quiz/v1:${round}`) }, key, Buffer.from(item.ciphertext, 'base64url'))
    decryptedPackages[round] = new TextDecoder().decode(plain)
  }

  for (const round of [1, 2]) {
    const section = decryptedPackages[round]
    assert.ok(section.includes(`id="round-${round}"`), `Package ${round} decrypts`)
    assert.equal((section.match(/class="question(?: |")/g) || []).length, 16, `Package ${round} has 16 answers`)
  }
  for (const phrase of ['Narasi kasus', 'Berkas bukti', 'Antrean KRS', 'Akun vendor', 'Failover cepat', 'Gerbang administrasi']) {
    assert.ok(!html.includes(phrase), `Published HTML hides plaintext: ${phrase}`)
  }
  assert.ok(!/<h2>\s*(?:Round|Ronde)\s*[12]/i.test(html), 'No visible round headings')
  assert.ok(!html.includes('change-package'), 'No package switch button')
  assert.ok(html.includes('id="rubric-dialog"') && html.includes('showModal()'), 'Grading rubric is available')
  assert.equal((Object.values(decryptedPackages).join('').match(/<summary>Acuan istilah/g) || []).length, 4, 'Each case includes neutral term references')

  const publicKey = await webcrypto.subtle.importKey('jwk', constant('EXPORT_PUBLIC_KEY'), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  const secretLine = fs.readFileSync(path.join(root, '.env.cisa.local'), 'utf8').trim()
  assert.ok(secretLine.startsWith('CISA_CASE_PRIVATE_JWK='))
  const privateJwk = JSON.parse(secretLine.slice(secretLine.indexOf('=') + 1))
  const privateKey = await webcrypto.subtle.importKey('jwk', privateJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
  const aesKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const rawKey = await webcrypto.subtle.exportKey('raw', aesKey)
  const wrapped = await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey)
  const unwrapped = await webcrypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, wrapped)
  assert.deepEqual(Buffer.from(unwrapped), Buffer.from(rawKey), 'Server key unwraps offline export key')
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const sample = new TextEncoder().encode(JSON.stringify({ schema: 'cisa-d4d5-workpaper/v1', answer: 'uji offline' }))
  const cipher = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, sample)
  const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, await webcrypto.subtle.importKey('raw', unwrapped, 'AES-GCM', false, ['decrypt']), cipher)
  assert.deepEqual(Buffer.from(decrypted), Buffer.from(sample), 'Encrypted payload decrypts')
  console.log('CISA worksheet checks passed: script, 2 passwords, 16 answers/package, encryption roundtrip.')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
