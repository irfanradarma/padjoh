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
import VibersPage from './pages/VibersPage'
import AppLogo from './components/AppLogo'

// ── Hash routing ──────────────────────────────────────────────
const VALID_PAGES = ['dashboard', 'mindmap', 'forum', 'deadline', 'user-management', 'login-logs', 'quiz-mgmt', 'vibers']

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
  'vibers':           'Vibers',
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
        <div className="pw-modal-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--accent)" strokeWidth="1.75"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
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
  const [sidebarCollapsed, setCollapsed] = useState(true)   // desktop icon-only; expands on hover
  const [sidebarOpen, setSidebarOpen]    = useState(false)  // mobile drawer
  const [notifications, setNotifications] = useState([])    // unread for current user

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
    if (newPage.type === 'forum')  markReadByType('forum')
    if (newPage.type === 'class')  markReadByType('quiz')
    if (newPage.type === 'vibers') markReadByType('vibers')
    const hash = pageToHash(newPage)
    if (window.location.hash !== hash) window.location.hash = hash
    else setPage(newPage)
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setAllStudents(data ?? []))
  }, [profile.is_admin])

  // Notifications: only for real non-admin users (not in masquerade)
  useEffect(() => {
    if (profile.is_admin) return
    supabase.rpc('get_my_notifications').then(({ data }) => setNotifications(data ?? []))
    const ch = supabase
      .channel('my-notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        payload => {
          const n = payload.new
          if (n) setNotifications(prev => [{ id: n.id, type: n.type, title: n.title, ref_id: n.ref_id, created_at: n.created_at }, ...prev])
        }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile.is_admin, profile.id])

  function markReadByType(type) {
    if (profile.is_admin) return
    const hasUnread = notifications.some(n => n.type === type)
    if (!hasUnread) return
    setNotifications(prev => prev.filter(n => n.type !== type))
    supabase.rpc('mark_all_notifications_read', { p_type: type })
  }

  function markAllRead() {
    if (profile.is_admin) return
    setNotifications([])
    supabase.rpc('mark_all_notifications_read', { p_type: null })
  }

  const quizNotifCount   = notifications.filter(n => n.type === 'quiz').length
  const forumNotifCount  = notifications.filter(n => n.type === 'forum').length
  const vibersNotifCount = notifications.filter(n => n.type === 'vibers').length
  const totalNotifCount  = notifications.length

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
    const g = sectionGroup(sectionId)
    if (g === 'pre') setPreOpen(true)
    else setPostOpen(true)
    navigate({ type: 'class', sectionId })
  }

  function togglePre()  { setPreOpen(x => !x) }
  function togglePost() { setPostOpen(x => !x) }

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

      <aside
        className={cls}
        onMouseEnter={() => { if (window.innerWidth > 768) setCollapsed(false) }}
        onMouseLeave={() => { if (window.innerWidth > 768) setCollapsed(true) }}
      >
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
                ? <span style={{ color: '#d97706' }}>Mode Uji</span>
                : profile.is_admin ? 'Administrator' : profile.class}
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
          {!profile.is_admin && totalNotifCount > 0 && (
            <div className="nav-item notif-bell-row" title="Notifikasi" onClick={markAllRead}>
              <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></span>
              <span className="nav-label">Notifikasi</span>
              <span className="notif-count-badge">{totalNotifCount}</span>
            </div>
          )}

          <div
            className={`nav-item${page.type === 'dashboard' ? ' active' : ''}`}
            title="Dashboard"
            onClick={() => navigate({ type: 'dashboard' })}
          >
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
            <span className="nav-label">Dashboard</span>
          </div>

          <div className={`nav-item${preOpen && !sidebarCollapsed ? ' open' : ''}`} title="Pre-UTS" onClick={togglePre}>
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></span>
            <span className="nav-label">Pre-UTS</span>
            {!profile.is_admin && quizNotifCount > 0 && <span className="nav-notif-dot" />}
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
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg></span>
            <span className="nav-label">Post-UTS</span>
            {!profile.is_admin && quizNotifCount > 0 && <span className="nav-notif-dot" />}
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
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12"/></svg></span>
            <span className="nav-label">Mind Map</span>
          </div>

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'deadline' ? ' active' : ''}`}
              title="Kelola Deadline"
              onClick={() => navigate({ type: 'deadline' })}
            >
              <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
              <span className="nav-label">Kelola Deadline</span>
            </div>
          )}

          <div
            className={`nav-item${page.type === 'forum' ? ' active' : ''}`}
            title="Forum"
            onClick={() => navigate({ type: 'forum' })}
          >
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span>
            <span className="nav-label">Forum</span>
            {!profile.is_admin && forumNotifCount > 0 && <span className="nav-notif-dot" />}
          </div>

          <div
            className={`nav-item${page.type === 'vibers' ? ' active' : ''}`}
            title="Vibers"
            onClick={() => navigate({ type: 'vibers' })}
          >
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
            <span className="nav-label">Vibers</span>
            {!profile.is_admin && vibersNotifCount > 0 && <span className="nav-notif-dot" />}
          </div>

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'user-management' ? ' active' : ''}`}
              title="Manajemen Pengguna"
              onClick={() => navigate({ type: 'user-management' })}
            >
              <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></span>
              <span className="nav-label">Manajemen Pengguna</span>
            </div>
          )}

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'login-logs' ? ' active' : ''}`}
              title="Log Login"
              onClick={() => navigate({ type: 'login-logs' })}
            >
              <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
              <span className="nav-label">Log Login</span>
            </div>
          )}

          {profile.is_admin && (
            <div
              className={`nav-item${page.type === 'quiz-mgmt' ? ' active' : ''}`}
              title="Manajemen Kuis"
              onClick={() => navigate({ type: 'quiz-mgmt' })}
            >
              <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
              <span className="nav-label">Manajemen Kuis</span>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}>
            <span className="nav-icon">
              {theme === 'dark'
                ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
            </span>
            <span className="nav-label">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <div className="nav-item" onClick={() => supabase.auth.signOut()} title="Keluar">
            <span className="nav-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
            <span className="nav-label">Keluar</span>
          </div>
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
          {!profile.is_admin && totalNotifCount > 0 && (
            <button className="mobile-notif-btn" onClick={markAllRead} aria-label="Notifikasi">
              🔔<span className="mobile-notif-badge">{totalNotifCount}</span>
            </button>
          )}
          <button className="mobile-theme-btn" onClick={toggleTheme} aria-label="Ganti tema">
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e2e8f0" strokeWidth="1.75"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e2e8f0" strokeWidth="1.75"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            }
          </button>
        </div>

        {isMasq && (
          <div className="masq-banner">
            <span>
              Mode uji — <strong>{masqAs.name}</strong>
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
        {visited.has('vibers') && (
          <div style={{ display: page.type === 'vibers' ? '' : 'none' }}>
            <VibersPage key={masqAs?.id ?? 'self'} profile={viewProfile} />
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
