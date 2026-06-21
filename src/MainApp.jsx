import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { SECTIONS, PRE_UTS, POST_UTS } from './sections'
import DashboardPage from './pages/DashboardPage'
import ClassPage from './pages/ClassPage'
import MindmapPage from './pages/MindmapPage'
import ForumPage from './pages/ForumPage'
import UserManagementPage from './pages/UserManagementPage'
import LoginLogsPage from './pages/LoginLogsPage'
import DeadlinePage from './pages/DeadlinePage'
import QuizManagementPage from './pages/QuizManagementPage'
import AppLogo from './components/AppLogo'

// ── Hash routing ──────────────────────────────────────────────
const VALID_PAGES = ['dashboard', 'mindmap', 'forum', 'deadline', 'user-management', 'login-logs', 'quiz-mgmt']

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
  dashboard:          'Dashboard',
  mindmap:            'Mind Map',
  forum:              'Forum',
  deadline:           'Kelola Deadline',
  'user-management':  'Manajemen Pengguna',
  'login-logs':       'Log Login',
  'quiz-mgmt':        'Manajemen Kuis',
}

// ─────────────────────────────────────────────────────────────

function ChangePasswordModal({ onClose, isForced = false }) {
  const [pw, setPw]         = useState('')
  const [pw2, setPw2]       = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 8) { setErr('Password minimal 8 karakter.'); return }
    if (pw !== pw2)    { setErr('Konfirmasi password tidak cocok.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setErr(error.message); setSaving(false); return }
    await supabase.rpc('mark_password_changed')
    onClose()
  }

  return (
    <div className="pw-overlay">
      <div className="pw-modal">
        <div className="pw-modal-icon">🔐</div>
        <h3 className="pw-modal-title">
          {isForced ? 'Ganti Password Default' : 'Ganti Password'}
        </h3>
        {isForced && (
          <p className="pw-modal-desc">
            Akun Anda masih menggunakan password bawaan. Ganti sekarang untuk keamanan akun Anda.
          </p>
        )}
        <form onSubmit={submit}>
          <input
            type="password"
            className="input"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Password baru (min. 8 karakter)"
            autoFocus
          />
          <input
            type="password"
            className="input"
            value={pw2}
            onChange={e => setPw2(e.target.value)}
            placeholder="Konfirmasi password baru"
            style={{ marginTop: 10 }}
          />
          {err && <div className="pw-modal-err">{err}</div>}
          <div className="pw-modal-btns">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>
              {isForced ? 'Nanti' : 'Batal'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={saving || !pw || !pw2}
            >
              {saving ? 'Menyimpan…' : 'Ganti Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MainApp({ session, profile, theme, toggleTheme }) {
  const initialPage = hashToPage(window.location.hash)

  const [page, setPage]               = useState(initialPage)
  const [starsMap, setStarsMap]       = useState({})
  const [masqAs, setMasqAs]           = useState(null)
  const [allStudents, setAllStudents] = useState([])
  const [pwModalDone, setPwModalDone]   = useState(false)
  const [manualPwOpen, setManualPwOpen] = useState(false)
  const [sidebarCollapsed, setCollapsed] = useState(false)  // desktop icon-only
  const [sidebarOpen, setSidebarOpen]    = useState(false)  // mobile drawer

  const initialSection = initialPage.type === 'class' ? SECTIONS.find(s => s.id === initialPage.sectionId) : null
  const [preOpen, setPreOpen]   = useState(initialSection?.group === 'pre')
  const [postOpen, setPostOpen] = useState(initialSection?.group === 'post')
  // Lazy-mount: track which page types have ever been visited
  const [visited, setVisited]           = useState(() => new Set([initialPage.type]))
  const [lastSectionId, setLastSection] = useState(initialPage.type === 'class' ? initialPage.sectionId : null)

  // Close mobile sidebar on hash change / resize
  useEffect(() => {
    const handler = () => {
      const p = hashToPage(window.location.hash)
      setPage(p)
      setSidebarOpen(false)
      setVisited(prev => new Set([...prev, p.type]))
      if (p.type === 'class' && p.sectionId) setLastSection(p.sectionId)
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setSidebarOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  function navigate(newPage) {
    setVisited(prev => new Set([...prev, newPage.type]))
    if (newPage.type === 'class' && newPage.sectionId) setLastSection(newPage.sectionId)
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

  const isMasq     = !!masqAs
  const autoPwShow = !masqAs && !profile.is_admin && profile.must_change_password === true && !pwModalDone
  function closePwModal() { setManualPwOpen(false); setPwModalDone(true) }
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
            <div className="sidebar-logo-icon"><AppLogo size={20} /></div>
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
            {!profile.is_admin && !isMasq && !sidebarCollapsed && (
              <button className="sidebar-pw-link" onClick={() => setManualPwOpen(true)}>
                Ganti Password
              </button>
            )}
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

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'user-management' ? ' active' : ''}`}
              title="Manajemen Pengguna"
              onClick={() => navigate({ type: 'user-management' })}
            >
              <span className="nav-icon">👥</span>
              <span className="nav-label">Manajemen Pengguna</span>
            </div>
          )}

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'login-logs' ? ' active' : ''}`}
              title="Log Login"
              onClick={() => navigate({ type: 'login-logs' })}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-label">Log Login</span>
            </div>
          )}

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'quiz-mgmt' ? ' active' : ''}`}
              title="Manajemen Kuis"
              onClick={() => navigate({ type: 'quiz-mgmt' })}
            >
              <span className="nav-icon">🎯</span>
              <span className="nav-label">Manajemen Kuis</span>
            </div>
          )}
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
            <AppLogo size={22} className="mobile-header-icon" />
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

        {visited.has('dashboard') && (
          <div style={{ display: page.type === 'dashboard' ? '' : 'none' }}>
            <DashboardPage
              key={masqAs?.id ?? 'self'}
              profile={viewProfile}
              starsMap={starsMap}
              onNavigate={goToClass}
              onManageDeadlines={() => navigate({ type: 'deadline' })}
            />
          </div>
        )}
        {visited.has('class') && lastSectionId && (
          <div style={{ display: page.type === 'class' ? '' : 'none' }}>
            <ClassPage
              key={lastSectionId}
              sectionId={lastSectionId}
              session={session}
              profile={viewProfile}
              starsMap={starsMap}
            />
          </div>
        )}
        {visited.has('mindmap') && (
          <div style={{ display: page.type === 'mindmap' ? '' : 'none' }}>
            <MindmapPage key={masqAs?.id ?? 'self'} profile={viewProfile} />
          </div>
        )}
        {visited.has('forum') && (
          <div style={{ display: page.type === 'forum' ? '' : 'none' }}>
            <ForumPage key={masqAs?.id ?? 'self'} profile={viewProfile} />
          </div>
        )}
        {visited.has('deadline') && profile.is_admin && (
          <div style={{ display: page.type === 'deadline' ? '' : 'none' }}>
            <DeadlinePage />
          </div>
        )}
        {visited.has('user-management') && profile.is_admin && (
          <div style={{ display: page.type === 'user-management' ? '' : 'none' }}>
            <UserManagementPage />
          </div>
        )}
        {visited.has('login-logs') && profile.is_admin && (
          <div style={{ display: page.type === 'login-logs' ? '' : 'none' }}>
            <LoginLogsPage />
          </div>
        )}
        {visited.has('quiz-mgmt') && profile.is_admin && (
          <div style={{ display: page.type === 'quiz-mgmt' ? '' : 'none' }}>
            <QuizManagementPage />
          </div>
        )}
      </main>

      {(manualPwOpen || autoPwShow) && (
        <ChangePasswordModal
          isForced={autoPwShow && !manualPwOpen}
          onClose={closePwModal}
        />
      )}
    </div>
  )
}
