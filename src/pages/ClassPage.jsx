import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SECTIONS } from '../sections'
import NotesTab from './tabs/NotesTab'
import ExerciseTab from './tabs/ExerciseTab'
import ActivitiesTab from './tabs/ActivitiesTab'

const TABS = [
  { id: 'notes',      label: '📝 Notes'      },
  { id: 'exercise',   label: '📎 Exercise'   },
  { id: 'activities', label: '⭐ Activities' },
]

export default function ClassPage({ sectionId, session, profile, starsMap = {} }) {
  const [activeTab, setActiveTab]             = useState('notes')
  const [visitedTabs, setVisitedTabs]         = useState(() => new Set(['notes']))
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [searchText, setSearchText]           = useState('')
  const [students, setStudents]               = useState([])
  const [dropdownOpen, setDropdownOpen]       = useState(false)
  const dropdownRef = useRef()

  const section = SECTIONS.find(s => s.id === sectionId)
  const group   = section?.group === 'pre' ? 'Pre-UTS' : 'Post-UTS'

  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [profile.is_admin])

  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedStudent = students.find(s => s.id === selectedStudentId)

  const filteredStudents = students.filter(s => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return s.name?.toLowerCase().includes(q) || s.npm?.includes(searchText)
  })

  function selectStudent(id) {
    setSelectedStudentId(id)
    setSearchText('')
    setDropdownOpen(false)
  }

  const sharedProps = { sectionId, userId: session.user.id, profile, selectedStudentId, students, starsMap }

  return (
    <div className="page-content">
      <div className="page-breadcrumb">
        {group} › <span>Sesi {sectionId}</span>
      </div>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{section?.title}</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Information System Audit — jurnal kelas</p>
            {!profile.is_admin && starsMap[sectionId] > 0 && (
              <div className="section-stars-badge">
                {'★'.repeat(starsMap[sectionId])} &nbsp;{starsMap[sectionId]} bintang
              </div>
            )}
          </div>

          {profile.is_admin && (
            <div className="student-search-box" ref={dropdownRef}>
              <div className="student-search-label">Filter mahasiswa</div>
              <div className="student-search-wrap">
                <input
                  className="student-search-input"
                  placeholder="🔍 Semua mahasiswa"
                  value={dropdownOpen ? searchText : (selectedStudent ? selectedStudent.name : '')}
                  onChange={e => { setSearchText(e.target.value); setDropdownOpen(true) }}
                  onFocus={() => { setSearchText(''); setDropdownOpen(true) }}
                />
                {selectedStudentId && (
                  <button className="student-search-clear" onClick={() => selectStudent('')}>×</button>
                )}
              </div>

              {dropdownOpen && (
                <div className="student-search-dropdown">
                  <div
                    className={`student-search-opt${!selectedStudentId ? ' selected' : ''}`}
                    onMouseDown={() => selectStudent('')}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>Semua mahasiswa</span>
                    <span className="opt-count">{students.length}</span>
                  </div>
                  {filteredStudents.map(s => (
                    <div
                      key={s.id}
                      className={`student-search-opt${selectedStudentId === s.id ? ' selected' : ''}`}
                      onMouseDown={() => selectStudent(s.id)}
                    >
                      <div>
                        <div className="opt-name">{s.name}</div>
                        <div className="opt-meta">{s.npm} · {s.class}</div>
                      </div>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <div className="search-no-result">Tidak ada hasil</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => { setActiveTab(t.id); setVisitedTabs(p => new Set([...p, t.id])) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visitedTabs.has('notes') && (
        <div style={{ display: activeTab === 'notes' ? '' : 'none' }}><NotesTab {...sharedProps} /></div>
      )}
      {visitedTabs.has('exercise') && (
        <div style={{ display: activeTab === 'exercise' ? '' : 'none' }}><ExerciseTab {...sharedProps} /></div>
      )}
      {visitedTabs.has('activities') && (
        <div style={{ display: activeTab === 'activities' ? '' : 'none' }}><ActivitiesTab {...sharedProps} /></div>
      )}
    </div>
  )
}
