import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SECTIONS } from '../sections'

export default function DashboardPage({ profile, onNavigate }) {
  const [assignments, setAssignments] = useState([])
  const [noteCount, setNoteCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: n }] = await Promise.all([
        supabase
          .from('assignments')
          .select('*')
          .gte('due_date', new Date().toISOString())
          .order('due_date', { ascending: true })
          .limit(6),
        supabase
          .from('notes')
          .select('id')
          .neq('content', ''),
      ])
      setAssignments(a ?? [])
      setNoteCount(n?.length ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  function urgency(dateStr) {
    const days = (new Date(dateStr) - Date.now()) / 86_400_000
    if (days <= 2) return 'urgent'
    if (days <= 7) return 'soon'
    return ''
  }

  function fmtDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Selamat datang, {profile.name ?? profile.npm}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Jurnal Ditulis</div>
          <div className="stat-value">{noteCount}</div>
          <div className="stat-sub">dari 16 sesi</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Sesi</div>
          <div className="stat-value">16</div>
          <div className="stat-sub">Pre-UTS + Post-UTS</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deadline Mendatang</div>
          <div className="stat-value">{assignments.length}</div>
          <div className="stat-sub">tugas aktif</div>
        </div>
      </div>

      <p className="section-heading">Deadline Terdekat</p>

      {loading ? (
        <div className="empty-state"><p>Memuat…</p></div>
      ) : assignments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <p>Tidak ada deadline mendatang</p>
        </div>
      ) : (
        <div className="deadline-list">
          {assignments.map(a => {
            const u = urgency(a.due_date)
            const section = SECTIONS.find(s => s.id === a.section_id)
            return (
              <div
                key={a.id}
                className="deadline-item"
                style={{ cursor: 'pointer' }}
                onClick={() => section && onNavigate(section.id)}
              >
                <div className={`deadline-dot${u ? ` ${u}` : ''}`} />
                <div className="deadline-info">
                  <div className="deadline-title">{a.title}</div>
                  <div className="deadline-meta">{section?.title ?? `Sesi ${a.section_id}`}</div>
                </div>
                <div className={`deadline-date${u ? ` ${u}` : ''}`}>{fmtDate(a.due_date)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
