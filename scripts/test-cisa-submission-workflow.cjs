const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const edgeSource = fs.readFileSync(path.join(root, 'supabase/functions/cisa-case-submission/index.ts'), 'utf8')
const uiSource = fs.readFileSync(path.join(root, 'src/pages/CisaCaseSubmissions.jsx'), 'utf8')

function withLatestFlag(rows) {
  const seen = new Set()
  return rows.map(row => {
    const key = `${row.team_key}:${row.round}`
    const is_latest = !seen.has(key)
    seen.add(key)
    return { ...row, is_latest }
  })
}
const memberCanSee = (row, id) => row.members.some(member => member.id === id)

const rows = withLatestFlag([
  { id: 'new-a1', team_key: 'team-a', round: 1, class_name: 'Audit-2', status: 'pending', members: [{ id: 'student-a' }, { id: 'student-b' }] },
  { id: 'old-a1', team_key: 'team-a', round: 1, class_name: 'Audit-2', status: 'graded', members: [{ id: 'student-a' }, { id: 'student-b' }] },
  { id: 'new-a2', team_key: 'team-a', round: 2, class_name: 'Audit-2', status: 'pending', members: [{ id: 'student-a' }, { id: 'student-b' }] },
  { id: 'new-c1', team_key: 'team-c', round: 1, class_name: 'Audit-BL', status: 'pending', members: [{ id: 'student-c' }, { id: 'student-d' }] },
])

for (const teammate of ['student-a', 'student-b']) {
  assert.deepEqual(rows.filter(row => memberCanSee(row, teammate) && row.is_latest).map(row => row.id), ['new-a1', 'new-a2'])
}
assert.deepEqual(rows.filter(row => memberCanSee(row, 'student-c') && row.is_latest).map(row => row.id), ['new-c1'])
assert.deepEqual(rows.filter(row => row.is_latest && row.class_name === 'Audit-2' && row.status !== 'graded').map(row => row.id), ['new-a1', 'new-a2'])

assert.match(edgeSource, /\.contains\('members', \[\{ id: profile\.id \}\]\)/)
assert.match(edgeSource, /profile\.is_admin \? marked : marked\.filter/)
assert.doesNotMatch(edgeSource, /gradeSubmission\(sb, saved\)/)
assert.match(uiSource, /Submission tim saya/)
assert.match(uiSource, /Nilai kelas/)
assert.match(uiSource, /row\.assessment\.total/)
console.log('CISA submission workflow simulation passed: teammate visibility, latest versions, class grading queue, and feedback UI.')
