import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const ACTION_LABEL = { login: 'Login', logout: 'Logout' }

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LoginLogsPage() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [limit, setLimit]     = useState(300)

  useEffect(() => { load() }, [limit])

  async function load() {
    setLoading(true)
    setLoadErr(null)
    const { data, error } = await supabase.rpc('admin_get_login_logs', { p_limit: limit })
    if (error) {
      setLoadErr(error.message)
      setLogs([])
    } else {
      setLogs(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    let result = logs
    if (filter !== 'all') result = result.filter(l => l.action === filter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        (l.name  ?? '').toLowerCase().includes(q) ||
        (l.npm   ?? '').toLowerCase().includes(q) ||
        (l.class ?? '').toLowerCase().includes(q) ||
        (l.ip_address ?? '').includes(q)
      )
    }
    return result
  }, [logs, filter, search])

  const loginCount  = logs.filter(l => l.action === 'login').length
  const logoutCount = logs.filter(l => l.action === 'logout').length

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Log Login Pengguna</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {loginCount} login · {logoutCount} logout dari {limit} entri terakhir
        </p>
      </div>

      <div className="um-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="input um-search"
          placeholder="Cari nama, NPM, kelas, atau IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="ll-filter-row">
          <select className="ll-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Semua aksi</option>
            <option value="login">Login saja</option>
            <option value="logout">Logout saja</option>
          </select>
          <select className="ll-select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={100}>100 terakhir</option>
            <option value={300}>300 terakhir</option>
            <option value={500}>500 terakhir</option>
          </select>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
            onClick={load}
          >
            ↺ Muat ulang
          </button>
        </div>
      </div>

      {loadErr && (
        <div className="um-load-err">
          <strong>Gagal memuat log:</strong> {loadErr}
          <div style={{ marginTop: 6, fontSize: 12 }}>
            Jalankan <code>sql/patch_login_logs.sql</code> di Supabase Dashboard lalu muat ulang.
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Memuat log…</p></div>
      ) : loadErr ? null : filtered.length === 0 ? (
        <div className="empty-state"><p>Tidak ada data log ditemukan.</p></div>
      ) : (
        <div className="ll-table-wrap">
          <table className="um-table ll-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Nama</th>
                <th>NPM / ID</th>
                <th>Kelas</th>
                <th>Aksi</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td className="ll-td-time">{fmtDate(l.created_at)}</td>
                  <td>{l.name ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td className="um-td-npm">{l.npm ?? <span style={{ color: 'var(--muted)' }}>unknown</span>}</td>
                  <td>{l.class ?? '—'}</td>
                  <td>
                    <span className={`um-badge ${l.action === 'login' ? 'um-badge-ok' : 'um-badge-neutral'}`}>
                      {ACTION_LABEL[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="ll-td-ip">{l.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '12px 0', textAlign: 'right' }}>
        <button className="btn-sm" onClick={load}>↺ Muat ulang</button>
      </div>
    </div>
  )
}
