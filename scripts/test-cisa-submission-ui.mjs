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

  const { default: ExerciseTab } = await vite.ssrLoadModule('/src/pages/tabs/ExerciseTab.jsx')
  const uasStudent = renderToStaticMarkup(React.createElement(ExerciseTab, {
    sectionId: 15,
    userId: 'student-a',
    profile: { id: 'student-a', is_admin: false },
    students: [],
  }))
  assert.match(uasStudent, /Submission tim saya/)
  assert.doesNotMatch(uasStudent, /Belum ada file/)
  assert.doesNotMatch(uasStudent, /Penilaian Latihan/)

  const uasAdmin = renderToStaticMarkup(React.createElement(ExerciseTab, {
    sectionId: 15,
    userId: 'admin',
    profile: { id: 'admin', is_admin: true },
    students: [],
  }))
  assert.match(uasAdmin, /Submission dan penilaian kelas/)
  assert.doesNotMatch(uasAdmin, /Belum ada file/)
  assert.doesNotMatch(uasAdmin, /Penilaian Latihan/)
  console.log('CISA submission UI render passed for student and admin perspectives.')
} finally {
  await vite.close()
}
