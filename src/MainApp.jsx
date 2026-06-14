import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { SECTIONS, PRE_UTS, POST_UTS } from './sections'
import DashboardPage from './pages/DashboardPage'
import ClassPage from './pages/ClassPage'
import MindmapPage from './pages/MindmapPage'
import ForumPage from './pages/ForumPage'
import DeadlinePage from './pages/DeadlinePage'

// ── Hash routing ──────────────────────────────────────────────
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

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  mindmap:   'Mind Map',
  forum:     'Forum',
  deadline:  'Kelola Deadline',
}

// ─────────────────────────────────────────────────────────────

export default function MainApp({ session, profile, theme, toggleTheme }) {
  const initialPage = hashToPage(window.location.hash)

  const [page, setPage]               = useState(initialPage)
  const [starsMap, setStarsMap]       = useState({})
  const [masqAs, setMasqAs]           = useState(null)
  const [allStudents, setAllStudents] = useState([])
  const [sidebarCollapsed, setCollapsed] = useState(false)  // desktop icon-only
  const [sidebarOpen, setSidebarOpen]    = useState(false)  // mobile drawer

  const initialSection = initialPage.type === 'class' ? SECTIONS.find(s => s.id === initialPage.sectionId) : null
  const [preOpen, setPreOpen]   = useState(initialSection?.group === 'pre')
  const [postOpen, setPostOpen] = useState(initialSection?.group === 'post')

  // Close mobile sidebar on hash change / resize
  useEffect(() => {
    const handler = () => { setPage(hashToPage(window.location.hash)); setSidebarOpen(false) }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setSidebarOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  function navigate(newPage) {
    const hash = pageToHash(newPage)
    if (window.location.hash !== hash) window.location.hash = hash
    else setPage(newPage)
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setAllStudents(data ?? []))
  }, [profile.is_admin])

  const viewProfile = masqAs ? { ...masqAs, is_admin: false } : profile

  useEffect(() => {
    if (viewProfile.is_admin) { setStarsMap({}); return }
    supabase.rpc('get_my_stars').then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.section_id] = row.count
      setStarsMap(map)
    })
  }, [viewProfile.is_admin, masqAs])

  function goToClass(sectionId) {
    if (sidebarCollapsed) setCollapsed(false)
    const g = sectionGroup(sectionId)
    if (g === 'pre') setPreOpen(true)
    else setPostOpen(true)
    navigate({ type: 'class', sectionId })
  }

  function togglePre() {
    if (sidebarCollapsed) { setCollapsed(false); setPreOpen(true); return }
    setPreOpen(x => !x)
  }
  function togglePost() {
    if (sidebarCollapsed) { setCollapsed(false); setPostOpen(true); return }
    setPostOpen(x => !x)
  }

  function exitMasquerade() {
    setMasqAs(null)
    navigate({ type: 'dashboard' })
  }

  const initials = (profile.name ?? profile.npm ?? '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  const isMasq = !!masqAs
  const cls = `sidebar${sidebarCollapsed ? ' collapsed' : ''}${sidebarOpen ? ' mobile-open' : ''}`

  const pageLabel = page.type === 'class'
    ? (SECTIONS.find(s => s.id === page.sectionId)?.short ?? 'Sesi')
    : (PAGE_LABELS[page.type] ?? 'Dashboard')

  return (
    <div className="app">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={cls}>
        <div className="sidebar-header">
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon">📊</div>
            <div className="sidebar-logo-text-wrap">
              <div className="sidebar-logo-text">IS Audit Journal</div>
              <div className="sidebar-logo-sub">PKN STAN</div>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar" title={profile.name ?? profile.npm}>{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{profile.name ?? profile.npm}</div>
            <div className="sidebar-user-class">
              {isMasq
                ? <span style={{ color: 'var(--warning)' }}>👁️ Mode Uji</span>
                : profile.is_admin ? '👑 Administrator' : profile.class}
            </div>
          </div>
        </div>

        {profile.is_admin && !sidebarCollapsed && (
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
            title="Dashboard"
            onClick={() => navigate({ type: 'dashboard' })}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Dashboard</span>
          </div>

          <div className={`nav-item${preOpen && !sidebarCollapsed ? ' open' : ''}`} title="Pre-UTS" onClick={togglePre}>
            <span className="nav-icon">📚</span>
            <span className="nav-label">Pre-UTS</span>
            <span className="nav-chevron">›</span>
          </div>
          {preOpen && !sidebarCollapsed && (
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

          <div className={`nav-item${postOpen && !sidebarCollapsed ? ' open' : ''}`} title="Post-UTS" onClick={togglePost}>
            <span className="nav-icon">📖</span>
            <span className="nav-label">Post-UTS</span>
            <span className="nav-chevron">›</span>
          </div>
          {postOpen && !sidebarCollapsed && (
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
            title="Mind Map"
            onClick={() => navigate({ type: 'mindmap' })}
          >
            <span className="nav-icon">🗺️</span>
            <span className="nav-label">Mind Map</span>
          </div>

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'deadline' ? ' active' : ''}`}
              title="Kelola Deadline"
              onClick={() => navigate({ type: 'deadline' })}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-label">Kelola Deadline</span>
            </div>
          )}

          <div
            className={`nav-item${page.type === 'forum' ? ' active' : ''}`}
            title="Forum"
            onClick={() => navigate({ type: 'forum' })}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Forum</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}>
            <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="nav-label">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <div className="nav-item" onClick={() => supabase.auth.signOut()} title="Keluar">
            <span className="nav-icon">↩</span>
            <span className="nav-label">Keluar</span>
          </div>
          {/* Desktop collapse toggle */}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(x => !x)}
            title={sidebarCollapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
          >
            <span>{sidebarCollapsed ? '›' : '‹'}</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Mobile top bar */}
        <div className="mobile-header">
          <button className="mobile-hamburger" onClick={() => setSidebarOpen(x => !x)} aria-label="Buka menu">
            <span /><span /><span />
          </button>
          <div className="mobile-header-logo">
            <span className="mobile-header-icon">📊</span>
            <span className="mobile-header-title">{pageLabel}</span>
          </div>
          <button className="mobile-theme-btn" onClick={toggleTheme} aria-label="Ganti tema">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {isMasq && (
          <div className="masq-banner">
            <span>
              👁️ Mode uji — <strong>{masqAs.name}</strong>
              <span className="masq-banner-class">{masqAs.class} · {masqAs.npm}</span>
            </span>
            <button className="masq-exit-btn" onClick={exitMasquerade}>✕ Keluar</button>
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
