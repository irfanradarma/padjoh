import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

function UserModal({ mode, user, onClose, onSaved }) {
  const isAdd = mode === 'add'
  const [name, setName]       = useState(user?.name ?? '')
  const [npm, setNpm]         = useState(user?.npm ?? '')
  const [cls, setCls]         = useState(user?.class ?? '')
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim())       { setErr('Nama wajib diisi.'); return }
    if (!npm.trim())        { setErr('NPM / ID wajib diisi.'); return }
    setSaving(true); setErr('')

    const { error } = isAdd
      ? await supabase.rpc('admin_create_user', {
          p_name: name.trim(), p_npm: npm.trim(),
          p_class: cls.trim(), p_is_admin: isAdmin,
        })
      : await supabase.rpc('admin_update_user', {
          p_user_id: user.id, p_name: name.trim(), p_npm: npm.trim(),
          p_class: cls.trim(), p_is_admin: isAdmin,
        })

    if (error) { setErr(error.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="pw-overlay">
      <div className="pw-modal" style={{ maxWidth: 440, textAlign: 'left' }}>
        <h3 className="pw-modal-title" style={{ textAlign: 'center', marginBottom: 20 }}>
          {isAdd ? 'Tambah Pengguna' : 'Edit Pengguna'}
        </h3>
        <form onSubmit={submit}>
          <div className="um-field">
            <label className="um-label">Nama Lengkap</label>
            <input
              className="input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama lengkap" autoFocus
            />
          </div>
          <div className="um-field">
            <label className="um-label">NPM / ID Login</label>
            <input
              className="input" value={npm}
              onChange={e => setNpm(e.target.value)}
              placeholder="NPM atau ID unik" disabled={!isAdd}
            />
            {!isAdd && <div className="um-hint">NPM/ID tidak dapat diubah setelah dibuat.</div>}
          </div>
          <div className="um-field">
            <label className="um-label">Kelas</label>
            <input
              className="input" list="um-classes" value={cls}
              onChange={e => setCls(e.target.value)}
              placeholder="Misal: Audit-2"
            />
            <datalist id="um-classes">
              <option value="Audit-2" />
              <option value="Audit-BL" />
              <option value="admin" />
            </datalist>
          </div>
          <div className="um-field">
            <label className="um-checkbox-label">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              Administrator (dapat melihat semua data mahasiswa)
            </label>
          </div>
          {isAdd && (
            <div className="um-info-box">
              Password awal: <strong>PKNstan2025!</strong> — mahasiswa akan diminta ganti saat login pertama.
            </div>
          )}
          {err && <div className="pw-modal-err">{err}</div>}
          <div className="pw-modal-btns" style={{ marginTop: 20 }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
              {saving ? 'Menyimpan…' : isAdd ? 'Buat Pengguna' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserManagementPage() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [search, setSearch]   = useState('')
  const [modal, setModal]     = useState(null)
  const [busyId, setBusyId]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLoadErr(null)
    const { data, error } = await supabase.rpc('admin_get_all_users')
    if (error) {
      setLoadErr(error.message)
      setUsers([])
    } else {
      setUsers(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.npm  ?? '').toLowerCase().includes(q) ||
      (u.class ?? '').toLowerCase().includes(q)
    )
  }, [users, search])

  // Group by class, admins first
  const groups = useMemo(() => {
    const map = {}
    for (const u of filtered) {
      const k = u.is_admin ? '— Administrator' : (u.class ?? '(tanpa kelas)')
      if (!map[k]) map[k] = []
      map[k].push(u)
    }
    return Object.entries(map).sort(([a], [b]) => {
      if (a.startsWith('—')) return -1
      if (b.startsWith('—')) return 1
      return a.localeCompare(b)
    })
  }, [filtered])

  async function resetPw(u) {
    if (!window.confirm(`Reset password ${u.name ?? u.npm} ke default (PKNstan2025!)?`)) return
    setBusyId(u.id)
    const { error } = await supabase.rpc('admin_reset_password', { p_user_id: u.id })
    if (error) alert(error.message)
    setBusyId(null)
    load()
  }

  async function deleteUser(u) {
    if (!window.confirm(`Hapus pengguna "${u.name ?? u.npm}"?\nSeluruh data akan ikut dihapus dan tidak dapat dipulihkan.`)) return
    setBusyId(u.id)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: u.id })
    if (error) { alert(error.message); setBusyId(null); return }
    setUsers(prev => prev.filter(x => x.id !== u.id))
    setBusyId(null)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Manajemen Pengguna</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {users.length} pengguna terdaftar
        </p>
      </div>

      <div className="um-toolbar">
        <input
          className="input um-search"
          placeholder="Cari nama, NPM, atau kelas…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ width: 'auto', padding: '8px 18px', fontSize: 13 }}
          onClick={() => setModal({ mode: 'add' })}
        >
          + Tambah Pengguna
        </button>
      </div>

      {loadErr && (
        <div className="um-load-err">
          <strong>Gagal memuat data:</strong> {loadErr}
          {loadErr.includes('must_change_password') && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Jalankan <code>sql/patch_password_flag.sql</code> di Supabase Dashboard lalu muat ulang.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Memuat data pengguna…</p></div>
      ) : loadErr ? null : groups.length === 0 ? (
        <div className="empty-state"><p>Tidak ada pengguna ditemukan.</p></div>
      ) : (
        groups.map(([grpLabel, members]) => (
          <div key={grpLabel} className="um-class-group">
            <div className="um-class-header">
              <span className="um-class-name">{grpLabel}</span>
              <span className="um-class-count">{members.length} pengguna</span>
            </div>
            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NPM / ID</th>
                    <th>Kelas</th>
                    <th>Status PW</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(u => (
                    <tr key={u.id} className={busyId === u.id ? 'um-row-busy' : ''}>
                      <td className="um-td-name">{u.name ?? '—'}</td>
                      <td className="um-td-npm">{u.npm}</td>
                      <td>{u.class ?? '—'}</td>
                      <td>
                        {u.must_change_password
                          ? <span className="um-badge um-badge-warn">Default</span>
                          : <span className="um-badge um-badge-ok">Diubah</span>
                        }
                      </td>
                      <td className="um-td-actions">
                        <button
                          className="um-btn-sm"
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          disabled={!!busyId}
                        >Edit</button>
                        <button
                          className="um-btn-sm"
                          onClick={() => resetPw(u)}
                          disabled={!!busyId}
                          title="Reset ke PKNstan2025!"
                        >Reset PW</button>
                        <button
                          className="um-btn-sm um-btn-danger"
                          onClick={() => deleteUser(u)}
                          disabled={!!busyId}
                        >Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div style={{ padding: '12px 0', textAlign: 'right' }}>
        <button className="btn-sm" onClick={load}>↺ Muat ulang</button>
      </div>

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
