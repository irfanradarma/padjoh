import { useState } from 'react'
import { supabase } from './supabaseClient'
import { SECTIONS, PRE_UTS, POST_UTS } from './sections'
import DashboardPage from './pages/DashboardPage'
import ClassPage from './pages/ClassPage'
import MindmapPage from './pages/MindmapPage'

export default function MainApp({ session, profile }) {
  const [page, setPage] = useState({ type: 'dashboard' })
  const [preOpen, setPreOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)

  function goToClass(sectionId) {
    const s = SECTIONS.find(s => s.id === sectionId)
    if (s.group === 'pre') setPreOpen(true)
    else setPostOpen(true)
    setPage({ type: 'class', sectionId })
  }

  const initials = (profile.name ?? profile.npm ?? '?')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

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
            <div className="sidebar-user-class">{profile.is_admin ? '👑 Administrator' : profile.class}</div>
          </div>
        </div>

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
                  {s.short}
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
                  {s.short}
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
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item" onClick={() => supabase.auth.signOut()}>
            <span className="nav-icon">↩</span>
            <span className="nav-label">Keluar</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {page.type === 'dashboard' && (
          <DashboardPage profile={profile} onNavigate={goToClass} />
        )}
        {page.type === 'class' && (
          <ClassPage
            key={page.sectionId}
            sectionId={page.sectionId}
            session={session}
            profile={profile}
          />
        )}
        {page.type === 'mindmap' && <MindmapPage />}
      </main>
    </div>
  )
}
