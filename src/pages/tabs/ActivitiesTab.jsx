import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function ActivitiesTab({ sectionId, userId, profile }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [students, setStudents]     = useState([])
  const [targetId, setTargetId]     = useState(profile.is_admin ? '' : userId)
  const [form, setForm]             = useState({ title: '', score: '', description: '' })
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [profile.is_admin])

  useEffect(() => {
    if (!targetId) { setActivities([]); setLoading(false); return }
    loadActivities()
  }, [sectionId, targetId])

  async function loadActivities() {
    setLoading(true)
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', targetId)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false })
    setActivities(data ?? [])
    setLoading(false)
  }

  async function addActivity(e) {
    e.preventDefault()
    if (!form.title || !targetId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activities').insert({
      user_id:     targetId,
      section_id:  sectionId,
      title:       form.title,
      score:       form.score ? parseFloat(form.score) : null,
      description: form.description || null,
      created_by:  user.id,
    })
    setForm({ title: '', score: '', description: '' })
    await loadActivities()
    setSaving(false)
  }

  async function deleteActivity(id) {
    await supabase.from('activities').delete().eq('id', id)
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  function fmtDate(str) {
    return new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const targetStudent = students.find(s => s.id === targetId)

  return (
    <div>
      {profile.is_admin && (
        <div className="student-picker">
          <label>Pilih mahasiswa</label>
          <select
            className="student-select"
            style={{ maxWidth: 360 }}
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
          >
            <option value="">— Pilih mahasiswa —</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.npm}) · {s.class}
              </option>
            ))}
          </select>
        </div>
      )}

      {profile.is_admin && targetId && (
        <div className="admin-form">
          <h4>Tambah Aktivitas{targetStudent ? ` untuk ${targetStudent.name}` : ''}</h4>
          <form onSubmit={addActivity}>
            <div className="form-row">
              <div className="form-group-sm">
                <label>Judul *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Quiz 1"
                />
              </div>
              <div className="form-group-sm">
                <label>Nilai</label>
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={form.score}
                  onChange={e => setForm(p => ({ ...p, score: e.target.value }))}
                  placeholder="0 – 100"
                />
              </div>
            </div>
            <div className="form-group-sm">
              <label>Keterangan</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Opsional…"
                style={{ resize: 'none' }}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', padding: '8px 20px', display: 'inline-block' }}
              disabled={saving}
            >
              {saving ? 'Menyimpan…' : '+ Tambah'}
            </button>
          </form>
        </div>
      )}

      {!targetId && profile.is_admin ? (
        <div className="empty-state">
          <div className="icon">👆</div>
          <p>Pilih mahasiswa untuk melihat atau menambah aktivitas.</p>
        </div>
      ) : loading ? (
        <div className="empty-state"><p>Memuat aktivitas…</p></div>
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="icon">⭐</div>
          <p>Belum ada aktivitas untuk sesi ini.</p>
        </div>
      ) : (
        <div className="activity-list">
          {activities.map(a => (
            <div key={a.id} className="activity-item">
              <div className="activity-header">
                <div className="activity-title">{a.title}</div>
                <div className="activity-score">{a.score != null ? a.score : '—'}</div>
              </div>
              {a.description && <div className="activity-desc">{a.description}</div>}
              <div className="activity-footer">
                <div className="activity-date">{fmtDate(a.created_at)}</div>
                {profile.is_admin && (
                  <button className="btn-sm btn-danger" onClick={() => deleteActivity(a.id)}>Hapus</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
