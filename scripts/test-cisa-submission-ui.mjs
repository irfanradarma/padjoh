import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { default: Component } = await vite.ssrLoadModule('/src/pages/CisaCaseSubmissions.jsx')
  const student = renderToStaticMarkup(React.createElement(Component, { profile: { id: 'student-a', is_admin: false } }))
  assert.match(student, /Cukup satu anggota tim/)
  assert.match(student, /Submission tim saya/)
  assert.match(student, /Submission juga akan muncul jika diunggah oleh anggota tim Anda/)
  assert.doesNotMatch(student, /Nilai kelas/)

  const admin = renderToStaticMarkup(React.createElement(Component, { profile: { id: 'admin', is_admin: true } }))
  assert.match(admin, /Submission dan penilaian kelas/)
  assert.match(admin, /Nilai kelas \(0\)/)
  assert.doesNotMatch(admin, /Submission tim saya/)
  console.log('CISA submission UI render passed for student and admin perspectives.')
} finally {
  await vite.close()
}
