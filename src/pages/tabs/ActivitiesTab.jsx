import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

function StarSelector({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div className="star-selector" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          className={`star-btn${display >= n ? ' on' : ''}`}
          onMouseEnter={() => !disabled && setHover(n)}
          onClick={() => !disabled && onChange(value === n ? 0 : n)}
          disabled={disabled}
          title={`${n} bintang`}
        >★</button>
      ))}
      <span className="star-count-badge">{value > 0 ? value : '—'}</span>
    </div>
  )
}

function AdminActivitiesView({ sectionId, students }) {
  const [starsByUser, setStarsByUser] = useState({})
  const [saving, setSaving]           = useState({})
  const [classes, setClasses]         = useState([])
  const [activeClass, setActiveClass] = useState('')

  useEffect(() => {
    const cls = [...new Set(students.map(s => s.class).filter(Boolean))].sort()
    setClasses(cls)
    if (cls.length) setActiveClass(c => c && cls.includes(c) ? c : cls[0])
  }, [students])

  useEffect(() => {
    supabase.rpc('get_section_stars', { p_section_id: sectionId }).then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.user_id] = row.count
      setStarsByUser(map)
    })
  }, [sectionId])

  async function setStar(userId, count) {
    setSaving(prev => ({ ...prev, [userId]: true }))
    setStarsByUser(prev => ({ ...prev, [userId]: count }))
    await supabase.rpc('set_stars', { p_user_id: userId, p_section_id: sectionId, p_count: count })
    setSaving(prev => ({ ...prev, [userId]: false }))
  }

  const displayStudents = students.filter(s => s.class === activeClass)

  return (
    <div>
      <div className="class-tabs">
        {classes.map(cls => (
          <button
            key={cls}
            className={`class-tab${activeClass === cls ? ' active' : ''}`}
            onClick={() => setActiveClass(cls)}
          >{cls}</button>
        ))}
      </div>

      {displayStudents.length === 0 ? (
        <div className="empty-state"><p>Tidak ada mahasiswa di kelas ini.</p></div>
      ) : (
        <div className="stars-table-wrap">
          <table className="stars-table">
            <thead>
              <tr>
                <th>No</th>
                <th>NPM</th>
                <th>Nama</th>
                <th>Bintang</th>
              </tr>
            </thead>
            <tbody>
              {displayStudents.map((s, i) => (
                <tr key={s.id}>
                  <td className="td-no">{i + 1}</td>
                  <td className="td-npm">{s.npm}</td>
                  <td className="td-name">{s.name}</td>
                  <td className="td-stars">
                    <StarSelector
                      value={starsByUser[s.id] ?? 0}
                      onChange={count => setStar(s.id, count)}
                      disabled={!!saving[s.id]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StudentActivitiesView({ sectionId, starsMap }) {
  const count = starsMap?.[sectionId] ?? 0

  return (
    <div style={{ padding: '24px 0' }}>
      <div className="student-stars-display">
        <div className="student-stars-label">Bintang kamu di sesi ini</div>
        <div className="student-stars-row">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`star-display${i < count ? ' on' : ''}`}>★</span>
          ))}
          <span className="student-stars-count">{count} / 10</span>
        </div>
        {count === 0 && (
          <div className="student-stars-hint">Belum ada bintang untuk sesi ini.</div>
        )}
      </div>
    </div>
  )
}

export default function ActivitiesTab({ sectionId, profile, students, starsMap }) {
  if (profile.is_admin) {
    return <AdminActivitiesView sectionId={sectionId} students={students ?? []} />
  }
  return <StudentActivitiesView sectionId={sectionId} starsMap={starsMap} />
}
