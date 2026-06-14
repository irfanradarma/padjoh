import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { SECTIONS, PRE_UTS, POST_UTS } from './sections'
import DashboardPage from './pages/DashboardPage'
import ClassPage from './pages/ClassPage'
import MindmapPage from './pages/MindmapPage'
import ForumPage from './pages/ForumPage'

export default function MainApp({ session, profile, theme, toggleTheme }) {
  const [page, setPage]             = useState({ type: 'dashboard' })
  const [preOpen, setPreOpen]       = useState(false)
  const [postOpen, setPostOpen]     = useState(false)
  const [starsMap, setStarsMap]     = useState({})
  const [masqAs, setMasqAs]         = useState(null)   // { id, npm, name, class } | null
  const [allStudents, setAllStudents] = useState([])

  // Load student list for admin (used by masquerade picker)
  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setAllStudents(data ?? []))
  }, [profile.is_admin])

  // Load stars for student (or admin masquerading — uses admin's own account)
  const viewProfile = masqAs
    ? { ...masqAs, is_admin: false }
    : profile

  useEffect(() => {
    if (viewProfile.is_admin) { setStarsMap({}); return }
    supabase.rpc('get_my_stars').then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.section_id] = row.count
      setStarsMap(map)
    })
  }, [viewProfile.is_admin, masqAs])

  function goToClass(sectionId) {
    const s = SECTIONS.find(s => s.id === sectionId)
    if (s.group === 'pre') setPreOpen(true)
    else setPostOpen(true)
    setPage({ type: 'class', sectionId })
  }

  function exitMasquerade() {
    setMasqAs(null)
    setPage({ type: 'dashboard' })
  }

  const initials = (profile.name ?? profile.npm ?? '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  const isMasq = !!masqAs

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon">📊</div>
            <div>
              <div className="sidebar-logo-text">IS Audit Journal</div>
              <div className="sidebar-logo-sub">PKN STAN</div>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{profile.name ?? profile.npm}</div>
            <div className="sidebar-user-class">
              {isMasq
                ? <span style={{ color: 'var(--warning)' }}>👁️ Mode Uji</span>
                : profile.is_admin ? '👑 Administrator' : profile.class}
            </div>
          </div>
        </div>

        {/* Admin: masquerade picker */}
        {profile.is_admin && (
          <div className="masq-picker-wrap">
            <div className="masq-picker-label">Uji sebagai mahasiswa</div>
            <select
              className="masq-select"
              value={masqAs?.id ?? ''}
              onChange={e => {
                const student = allStudents.find(s => s.id === e.target.value) ?? null
                setMasqAs(student)
                setPage({ type: 'dashboard' })
              }}
            >
              <option value="">— Tampilan admin —</option>
              {allStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
              ))}
            </select>
          </div>
        )}

        <nav className="sidebar-nav">
          <div
            className={`nav-item${page.type === 'dashboard' ? ' active' : ''}`}
            onClick={() => setPage({ type: 'dashboard' })}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Dashboard</span>
          </div>

          <div
            className={`nav-item${preOpen ? ' open' : ''}`}
            onClick={() => setPreOpen(x => !x)}
          >
            <span className="nav-icon">📚</span>
            <span className="nav-label">Pre-UTS</span>
            <span className="nav-chevron">›</span>
          </div>
          {preOpen && (
            <div className="nav-children">
              {PRE_UTS.map(s => (
                <div
                  key={s.id}
                  className={`nav-child${page.type === 'class' && page.sectionId === s.id ? ' active' : ''}`}
                  onClick={() => goToClass(s.id)}
                >
                  <span className="nav-child-num">{s.id}</span>
                  <span style={{ flex: 1 }}>{s.short}</span>
                  {!viewProfile.is_admin && starsMap[s.id] > 0 && (
                    <span className="nav-stars-badge">★{starsMap[s.id]}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={`nav-item${postOpen ? ' open' : ''}`}
            onClick={() => setPostOpen(x => !x)}
          >
            <span className="nav-icon">📖</span>
            <span className="nav-label">Post-UTS</span>
            <span className="nav-chevron">›</span>
          </div>
          {postOpen && (
            <div className="nav-children">
              {POST_UTS.map(s => (
                <div
                  key={s.id}
                  className={`nav-child${page.type === 'class' && page.sectionId === s.id ? ' active' : ''}`}
                  onClick={() => goToClass(s.id)}
                >
                  <span className="nav-child-num">{s.id}</span>
                  <span style={{ flex: 1 }}>{s.short}</span>
                  {!viewProfile.is_admin && starsMap[s.id] > 0 && (
                    <span className="nav-stars-badge">★{starsMap[s.id]}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={`nav-item${page.type === 'mindmap' ? ' active' : ''}`}
            onClick={() => setPage({ type: 'mindmap' })}
          >
            <span className="nav-icon">🗺️</span>
            <span className="nav-label">Mind Map</span>
          </div>

          <div
            className={`nav-item${page.type === 'forum' ? ' active' : ''}`}
            onClick={() => setPage({ type: 'forum' })}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Forum</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <div className="nav-item" onClick={() => supabase.auth.signOut()}>
            <span className="nav-icon">↩</span>
            <span className="nav-label">Keluar</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {/* Masquerade banner */}
        {isMasq && (
          <div className="masq-banner">
            <span>
              👁️ Mode uji — tampilan sebagai <strong>{masqAs.name}</strong>
              <span className="masq-banner-class">{masqAs.class} · {masqAs.npm}</span>
            </span>
            <button className="masq-exit-btn" onClick={exitMasquerade}>
              ✕ Keluar dari mode uji
            </button>
          </div>
        )}

        {page.type === 'dashboard' && (
          <DashboardPage profile={viewProfile} starsMap={starsMap} onNavigate={goToClass} />
        )}
        {page.type === 'class' && (
          <ClassPage
            key={page.sectionId}
            sectionId={page.sectionId}
            session={session}
            profile={viewProfile}
            starsMap={starsMap}
          />
        )}
        {page.type === 'mindmap' && <MindmapPage profile={viewProfile} />}
        {page.type === 'forum'   && <ForumPage profile={viewProfile} />}
      </main>
    </div>
  )
}
