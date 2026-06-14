import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const DOMAINS = ['D2', 'D3', 'D4', 'D5']
const DOMAIN_TITLES = {
  D2: 'Domain 2: IT Governance and Management',
  D3: 'Domain 3: IS Acquisition, Development & Implementation',
  D4: 'Domain 4: IS Operations and Business Resilience',
  D5: 'Domain 5: Protection of Information Assets',
}
const LEVELS = ['level1', 'level2', 'level3', 'level4', 'level5']
const LEVEL_LABELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']

const emptyRow = () => ({ level1: '', level2: '', level3: '', level4: '', level5: '', summary: '' })

// ── Hierarchy conversion ─────────────────────────────────────

function rowsToNested(rows) {
  const root = {}
  for (const row of rows) {
    const vals = LEVELS.map(l => (row[l] || '').trim())
    let deepest = -1
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i]) { deepest = i; break }
    }
    if (deepest < 0) continue

    let cur = root
    for (let i = 0; i <= deepest; i++) {
      const v = vals[i]
      if (!v) continue
      const k = 'n_' + v.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
      if (!cur[k]) cur[k] = { __title: v }
      if (i === deepest) {
        cur[k].__summary = row.summary || ''
      } else {
        cur = cur[k]
      }
    }
  }
  return root
}

function nestedToTree(obj, depth = 0) {
  return Object.entries(obj)
    .filter(([k]) => k.startsWith('n_'))
    .map(([k, v]) => {
      const childEntries = Object.entries(v).filter(([ck]) => ck.startsWith('n_'))
      const children = nestedToTree(Object.fromEntries(childEntries), depth + 1)
      return {
        key: k,
        title: v.__title || '',
        summary: v.__summary || '',
        depth,
        children,
        isLeaf: children.length === 0,
      }
    })
}

// ── Mind Map Node (recursive) ────────────────────────────────

const DEPTH_STYLES = [
  { bg: 'var(--accent)',                 color: '#fff',          border: 'transparent'                },
  { bg: 'rgba(99,102,241,0.18)',         color: 'var(--text)',   border: 'rgba(99,102,241,0.35)'      },
  { bg: 'rgba(139,92,246,0.13)',         color: 'var(--text)',   border: 'rgba(139,92,246,0.25)'      },
  { bg: 'var(--surface2)',               color: 'var(--text)',   border: 'var(--border)'              },
  { bg: 'var(--surface)',                color: 'var(--muted)',  border: 'var(--border)'              },
]

function MapNode({ node }) {
  const [open, setOpen] = useState(node.depth < 1)
  const st = DEPTH_STYLES[Math.min(node.depth, DEPTH_STYLES.length - 1)]
  const hasContent = node.children.length > 0 || node.summary

  return (
    <div className="mm-node-wrap" style={{ marginLeft: node.depth > 0 ? 20 : 0 }}>
      <div
        className="mm-node"
        style={{ background: st.bg, color: st.color, borderColor: st.border }}
        onClick={() => hasContent && setOpen(x => !x)}
      >
        <span className="mm-node-icon">
          {node.isLeaf ? '💡' : open ? '📂' : '📁'}
        </span>
        <span className="mm-node-title">{node.title}</span>
        {hasContent && (
          <span className="mm-node-chevron">{open ? '▲' : '▼'}</span>
        )}
      </div>

      {open && (
        <div className="mm-node-children">
          {node.summary && (
            <div className="mm-node-summary">{node.summary}</div>
          )}
          {node.children.map((child, i) => (
            <MapNode key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sheet view ───────────────────────────────────────────────

function SheetView({ rows, onAdd, onDelete, onUpdate, onSave, saving, dirty, readOnly }) {
  return (
    <div className="mm-sheet-wrap">
      <div className="mm-sheet-scroll">
        <table className="mm-sheet-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              {LEVEL_LABELS.map(l => <th key={l}>{l}</th>)}
              <th>Summary</th>
              {!readOnly && <th style={{ width: 36 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="mm-row-num">{i + 1}</td>
                {LEVELS.map(lv => (
                  <td key={lv}>
                    <input
                      className="mm-cell-input"
                      value={row[lv] || ''}
                      onChange={e => !readOnly && onUpdate(i, lv, e.target.value)}
                      readOnly={readOnly}
                      placeholder={readOnly ? '' : '—'}
                    />
                  </td>
                ))}
                <td>
                  <input
                    className="mm-cell-input mm-cell-summary"
                    value={row.summary || ''}
                    onChange={e => !readOnly && onUpdate(i, 'summary', e.target.value)}
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Deskripsi singkat…'}
                  />
                </td>
                {!readOnly && (
                  <td style={{ padding: '0 4px' }}>
                    <button
                      className="mm-delete-btn"
                      onClick={() => onDelete(i)}
                      title="Hapus baris"
                    >×</button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  {readOnly ? 'Belum ada data.' : 'Belum ada baris. Klik "+ Tambah Baris" untuk mulai.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mm-sheet-actions">
          <button className="btn-sm" onClick={onAdd}>+ Tambah Baris</button>
          <button
            className={`btn-sm${dirty ? ' btn-sm-primary' : ''}`}
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Menyimpan…' : dirty ? '💾 Simpan' : '✓ Tersimpan'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────

export default function MindmapPage({ profile }) {
  const [domain, setDomain]               = useState('D2')
  const [mode, setMode]                   = useState('sheet')
  const [rows, setRows]                   = useState([emptyRow()])
  const [saving, setSaving]               = useState(false)
  const [dirty, setDirty]                 = useState(false)
  const [students, setStudents]           = useState([])
  const [selectedStudentId, setSelected]  = useState('')

  // Admin: load student list
  useEffect(() => {
    if (!profile.is_admin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [profile.is_admin])

  // Load rows whenever domain or selected student changes
  useEffect(() => {
    load()
  }, [domain, selectedStudentId])

  async function load() {
    if (profile.is_admin) {
      if (!selectedStudentId) { setRows([]); return }
      const { data } = await supabase.rpc('get_student_mindmap_data', {
        p_user_id: selectedStudentId,
        p_domain: domain,
      })
      setRows(data ?? [])
      return
    }
    const { data } = await supabase.rpc('get_my_mindmap', { p_domain: domain })
    setRows(data ?? [emptyRow()])
    setDirty(false)
  }

  function addRow()               { setRows(p => [...p, emptyRow()]); setDirty(true) }
  function deleteRow(i)           { setRows(p => p.filter((_, j) => j !== i)); setDirty(true) }
  function updateRow(i, fld, val) { setRows(p => p.map((r, j) => j === i ? { ...r, [fld]: val } : r)); setDirty(true) }

  async function save() {
    setSaving(true)
    await supabase.rpc('save_mindmap', { p_domain: domain, p_rows: rows })
    setSaving(false)
    setDirty(false)
  }

  const tree = nestedToTree(rowsToNested(rows))
  const isAdmin = profile.is_admin

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Mind Map IS Audit</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {isAdmin
            ? 'Lihat mind map mahasiswa per domain'
            : 'Isi peta konsep IS Audit kamu, lalu lihat hasilnya di tab Mind Map'}
        </p>
      </div>

      {/* Admin: student picker */}
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <select
            className="mm-student-select"
            value={selectedStudentId}
            onChange={e => setSelected(e.target.value)}
          >
            <option value="">— Pilih mahasiswa —</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.npm} · {s.class})</option>
            ))}
          </select>
        </div>
      )}

      {/* Domain tabs */}
      <div className="class-tabs" style={{ marginBottom: 0 }}>
        {DOMAINS.map(d => (
          <button
            key={d}
            className={`class-tab${domain === d ? ' active' : ''}`}
            onClick={() => setDomain(d)}
          >{d}</button>
        ))}
      </div>
      <div className="mm-domain-subtitle">{DOMAIN_TITLES[domain]}</div>

      {/* Content: guard for admin until student selected */}
      {isAdmin && !selectedStudentId ? (
        <div className="empty-state">
          <div className="icon">👤</div>
          <p>Pilih mahasiswa untuk melihat mind map mereka.</p>
        </div>
      ) : (
        <>
          {/* Mode tabs */}
          <div className="tabs">
            {!isAdmin && (
              <button
                className={`tab-btn${mode === 'sheet' ? ' active' : ''}`}
                onClick={() => setMode('sheet')}
              >📋 Sheet</button>
            )}
            <button
              className={`tab-btn${mode === 'map' ? ' active' : ''}`}
              onClick={() => setMode('map')}
            >🗺️ Mind Map</button>
            {isAdmin && (
              <button
                className={`tab-btn${mode === 'sheet' ? ' active' : ''}`}
                onClick={() => setMode('sheet')}
              >📋 Sheet (preview)</button>
            )}
          </div>

          {mode === 'sheet' && (
            <SheetView
              rows={rows}
              onAdd={addRow}
              onDelete={deleteRow}
              onUpdate={updateRow}
              onSave={save}
              saving={saving}
              dirty={dirty}
              readOnly={isAdmin}
            />
          )}

          {mode === 'map' && (
            <div className="mm-map-wrap">
              {tree.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">🗺️</div>
                  <p>
                    {isAdmin
                      ? 'Mahasiswa ini belum mengisi mind map untuk domain ini.'
                      : 'Belum ada data. Isi Sheet terlebih dahulu, lalu kembali ke sini.'}
                  </p>
                </div>
              ) : (
                tree.map((node, i) => <MapNode key={i} node={node} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
