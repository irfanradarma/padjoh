import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SECTIONS } from '../sections'

const empty = () => ({ title: '', description: '', due_date: '', section_id: '' })

function localDt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function urgencyLabel(iso) {
  const days = (new Date(iso) - Date.now()) / 86_400_000
  if (days < 0)   return { label: 'Lewat',      cls: 'badge-past'   }
  if (days <= 2)  return { label: 'Mendesak',   cls: 'badge-urgent' }
  if (days <= 7)  return { label: 'Minggu ini', cls: 'badge-soon'   }
  return            { label: 'Mendatang',   cls: 'badge-ok'     }
}

export default function DeadlinePage() {
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(null)   // null = closed, {} = new, {...} = edit
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [err, setErr]           = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_all_assignments')
    setList(data ?? [])
    setLoading(false)
  }

  function openNew()     { setForm(empty()); setErr('') }
  function openEdit(a)   {
    setForm({
      id: a.id, title: a.title, description: a.description,
      due_date: localDt(a.due_date), section_id: a.section_id ?? '',
    })
    setErr('')
  }
  function closeForm()   { setForm(null); setErr('') }

  async function handleSave() {
    if (!form.title.trim())    { setErr('Judul wajib diisi.'); return }
    if (!form.due_date)        { setErr('Tenggat waktu wajib diisi.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.rpc('upsert_assignment', {
      p_title:       form.title.trim(),
      p_description: form.description.trim(),
      p_due_date:    new Date(form.due_date).toISOString(),
      p_section_id:  form.section_id ? Number(form.section_id) : null,
      p_id:          form.id ?? null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    closeForm(); load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus deadline ini?')) return
    setDeleting(id)
    await supabase.rpc('delete_assignment', { p_id: id })
    setDeleting(null)
    load()
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Kelola Deadline</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Buat dan atur deadline / tugas yang ditampilkan di dashboard mahasiswa</p>
        </div>
        {!form && (
          <button className="btn-primary" onClick={openNew}>+ Tambah Deadline</button>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="dl-form-card">
          <div className="dl-form-title">{form.id ? '✏️ Edit Deadline' : '+ Tambah Deadline Baru'}</div>
          <div className="dl-form-grid">
            <div className="dl-form-group dl-span2">
              <label className="dl-label">Judul Tugas *</label>
              <input className="dl-input" placeholder="Mis. Pengumpulan Jurnal Sesi 5" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="dl-form-group">
              <label className="dl-label">Tenggat Waktu *</label>
              <input className="dl-input" type="datetime-local" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="dl-form-group">
              <label className="dl-label">Terkait Sesi (opsional)</label>
              <select className="dl-input" value={form.section_id} onChange={e => set('section_id', e.target.value)}>
                <option value="">— Tidak terkait sesi —</option>
                {SECTIONS.map(s => <option key={s.id} value={s.id}>Sesi {s.id}: {s.short}</option>)}
              </select>
            </div>
            <div className="dl-form-group dl-span2">
              <label className="dl-label">Penjelasan / Detail</label>
              <textarea className="dl-textarea" rows={4} placeholder="Jelaskan detail tugas, format pengumpulan, dll…" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
          {err && <div className="dl-form-error">⚠ {err}</div>}
          <div className="dl-form-actions">
            <button className="btn-ghost" onClick={closeForm}>Batal</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Buat Deadline'}</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="empty-state"><p>Memuat…</p></div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📅</div>
          <p>Belum ada deadline. Klik "+ Tambah Deadline" untuk membuat yang pertama.</p>
        </div>
      ) : (
        <div className="dl-list">
          {list.map(a => {
            const { label, cls } = urgencyLabel(a.due_date)
            const section = SECTIONS.find(s => s.id === a.section_id)
            const isExp = expanded === a.id
            return (
              <div key={a.id} className="dl-item">
                <div className="dl-item-main" onClick={() => setExpanded(isExp ? null : a.id)}>
                  <span className={`dl-badge ${cls}`}>{label}</span>
                  <div className="dl-item-info">
                    <div className="dl-item-title">{a.title}</div>
                    <div className="dl-item-meta">
                      <span>📅 {fmtDate(a.due_date)}</span>
                      {section && <span>· 📚 Sesi {section.id}: {section.short}</span>}
                    </div>
                  </div>
                  <div className="dl-item-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-sm" onClick={() => openEdit(a)}>✏️ Edit</button>
                    <button className="btn-sm btn-sm-danger" onClick={() => handleDelete(a.id)} disabled={deleting === a.id}>
                      {deleting === a.id ? '…' : '🗑 Hapus'}
                    </button>
                  </div>
                  <span className="dl-chevron">{isExp ? '▲' : '▼'}</span>
                </div>
                {isExp && a.description && (
                  <div className="dl-item-desc">{a.description}</div>
                )}
                {isExp && !a.description && (
                  <div className="dl-item-desc" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Tidak ada penjelasan tambahan.</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
