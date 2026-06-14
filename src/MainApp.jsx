import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { SECTIONS, PRE_UTS, POST_UTS } from './sections'
import DashboardPage from './pages/DashboardPage'
import ClassPage from './pages/ClassPage'
import MindmapPage from './pages/MindmapPage'
import ForumPage from './pages/ForumPage'
import DeadlinePage from './pages/DeadlinePage'

// ── Hash routing helpers ──────────────────────────────────────
const VALID_PAGES = ['dashboard', 'mindmap', 'forum', 'deadline']

function hashToPage(hash) {
  const h = (hash || '').replace(/^#\/?/, '')
  const [type, param] = h.split('/')
  if (type === 'class' && param && !isNaN(Number(param))) {
    const id = Number(param)
    if (SECTIONS.find(s => s.id === id)) return { type: 'class', sectionId: id }
  }
  if (VALID_PAGES.includes(type)) return { type }
  return { type: 'dashboard' }
}

function pageToHash(page) {
  if (page.type === 'class') return `#/class/${page.sectionId}`
  return `#/${page.type}`
}

function sectionGroup(sectionId) {
  return SECTIONS.find(s => s.id === sectionId)?.group ?? null
}

// ─────────────────────────────────────────────────────────────

export default function MainApp({ session, profile, theme, toggleTheme }) {
  const initialPage = hashToPage(window.location.hash)

  const [page, setPage]           = useState(initialPage)
  const [starsMap, setStarsMap]   = useState({})
  const [masqAs, setMasqAs]       = useState(null)
  const [allStudents, setAllStudents] = useState([])

  // Open the right sidebar accordion on load/restore
  const [preOpen, setPreOpen]   = useState(
    initialPage.type === 'class' && sectionGroup(initialPage.sectionId) === 'pre'
  )
  const [postOpen, setPostOpen] = useState(
    initialPage.type === 'class' && sectionGroup(initialPage.sectionId) === 'post'
  )

  // Sync browser hash → page state (back/forward, external reload)
  useEffect(() => {
    const handler = () => setPage(hashToPage(window.location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  // Navigate: write to hash (hashchange listener updates state)
  function navigate(newPage) {
    const hash = pageToHash(newPage)
    if (window.location.hash !== hash) window.location.hash = hash
    else setPage(newPage) // same hash — force re-render (e.g. reload same section)
  }

  // Load student list for admin
  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setAllStudents(data ?? []))
  }, [profile.is_admin])

  const viewProfile = masqAs ? { ...masqAs, is_admin: false } : profile

  // Load stars
  useEffect(() => {
    if (viewProfile.is_admin) { setStarsMap({}); return }
    supabase.rpc('get_my_stars').then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.section_id] = row.count
      setStarsMap(map)
    })
  }, [viewProfile.is_admin, masqAs])

  function goToClass(sectionId) {
    const g = sectionGroup(sectionId)
    if (g === 'pre') setPreOpen(true)
    else setPostOpen(true)
    navigate({ type: 'class', sectionId })
  }

  function exitMasquerade() {
    setMasqAs(null)
    navigate({ type: 'dashboard' })
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
                navigate({ type: 'dashboard' })
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
            onClick={() => navigate({ type: 'dashboard' })}
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
            onClick={() => navigate({ type: 'mindmap' })}
          >
            <span className="nav-icon">🗺️</span>
            <span className="nav-label">Mind Map</span>
          </div>

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'deadline' ? ' active' : ''}`}
              onClick={() => navigate({ type: 'deadline' })}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-label">Kelola Deadline</span>
            </div>
          )}

          <div
            className={`nav-item${page.type === 'forum' ? ' active' : ''}`}
            onClick={() => navigate({ type: 'forum' })}
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
          <DashboardPage
            profile={viewProfile}
            starsMap={starsMap}
            onNavigate={goToClass}
            onManageDeadlines={() => navigate({ type: 'deadline' })}
          />
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
        {page.type === 'mindmap'  && <MindmapPage profile={viewProfile} />}
        {page.type === 'forum'    && <ForumPage profile={viewProfile} />}
        {page.type === 'deadline' && profile.is_admin && <DeadlinePage />}
      </main>
    </div>
  )
}
