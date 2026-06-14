import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

// ── Constants ────────────────────────────────────────────────
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

const TEMPLATE_ROWS = [
  ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Summary'],
  ['IT Governance', '', '', '', '', 'Overview of IT governance framework and objectives'],
  ['IT Governance', 'Governance Framework', '', '', '', ''],
  ['IT Governance', 'Governance Framework', 'Board Oversight', '', '', 'Board-level responsibilities for IT decisions'],
  ['IT Governance', 'Governance Framework', 'IT Strategy', '', '', 'Alignment of IT strategy with business goals'],
  ['IT Governance', 'Risk Management', '', '', '', ''],
  ['IT Governance', 'Risk Management', 'Risk Assessment', '', '', 'Identification and evaluation of IT risks'],
  ['IT Governance', 'Risk Management', 'Risk Mitigation', '', '', 'Controls and countermeasures for identified risks'],
  ['IT Management', '', '', '', '', ''],
  ['IT Management', 'Performance Management', '', '', '', 'KPIs and metrics for IT performance'],
  ['IT Management', 'Resource Management', '', '', '', 'Human and technical resource allocation'],
]

// ── Hierarchy utilities ──────────────────────────────────────
function rowsToNested(rows) {
  const root = {}
  for (const row of rows) {
    const vals = LEVELS.map(l => (row[l] || '').trim())
    let deepest = -1
    for (let i = vals.length - 1; i >= 0; i--) { if (vals[i]) { deepest = i; break } }
    if (deepest < 0) continue
    let cur = root
    for (let i = 0; i <= deepest; i++) {
      const v = vals[i]
      if (!v) continue
      const k = 'n_' + v.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
      if (!cur[k]) cur[k] = { __title: v }
      if (i === deepest) cur[k].__summary = row.summary || ''
      else cur = cur[k]
    }
  }
  return root
}

function nestedToTree(obj, depth = 0, parentKey = null, path = []) {
  return Object.entries(obj)
    .filter(([k]) => k.startsWith('n_'))
    .map(([k, v]) => {
      const title = v.__title || ''
      const currentPath = [...path, title]
      const childEntries = Object.entries(v).filter(([ck]) => ck.startsWith('n_'))
      const children = childEntries.length > 0
        ? nestedToTree(Object.fromEntries(childEntries), depth + 1, k, currentPath)
        : []
      return { key: k, title, summary: v.__summary || '', depth, children, path: currentPath, parentKey, isLeaf: children.length === 0 }
    })
}

function applyNodeEdit(rows, node, newTitle, newSummary) {
  return rows.map(row => {
    const vals = LEVELS.map(l => (row[l] || '').trim())
    for (let i = 0; i < node.depth; i++) {
      if (vals[i] !== (node.path[i] || '')) return row
    }
    if (vals[node.depth] !== node.title) return row
    const newRow = { ...row }
    newRow[LEVELS[node.depth]] = newTitle
    const deepest = vals.reduce((m, v, i) => v ? i : m, -1)
    if (deepest === node.depth) newRow.summary = newSummary
    return newRow
  })
}

// ── Edit Panel ───────────────────────────────────────────────
function EditPanel({ node, onSave, onClose }) {
  const [title, setTitle]     = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  return (
    <div className="mm-edit-panel">
      <div className="mm-edit-header">
        <span>✏️ Edit node</span>
        <button className="mm-edit-close" onClick={onClose}>✕</button>
      </div>
      <div className="mm-edit-body">
        <label className="mm-edit-label">Judul</label>
        <input className="mm-edit-input" value={title} onChange={e => setTitle(e.target.value)} />
        <label className="mm-edit-label" style={{ marginTop: 10 }}>Summary</label>
        <textarea className="mm-edit-textarea" value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Deskripsi singkat…" />
        <div className="mm-edit-actions">
          <button className="btn-sm" onClick={onClose}>Batal</button>
          <button className="btn-sm btn-sm-primary" onClick={() => onSave(title, summary)}>Simpan</button>
        </div>
      </div>
    </div>
  )
}

// ── List Map (Style A) ────────────────────────────────────────
const DEPTH_STYLES = [
  { bg: 'var(--accent)',           color: '#fff',         border: 'transparent'           },
  { bg: 'rgba(99,102,241,0.18)',   color: 'var(--text)',  border: 'rgba(99,102,241,0.35)' },
  { bg: 'rgba(139,92,246,0.13)',   color: 'var(--text)',  border: 'rgba(139,92,246,0.25)' },
  { bg: 'var(--surface2)',         color: 'var(--text)',  border: 'var(--border)'         },
  { bg: 'var(--surface)',          color: 'var(--muted)', border: 'var(--border)'         },
]

function ListMapNode({ node, onEdit }) {
  const [open, setOpen] = useState(node.depth < 1)
  const st = DEPTH_STYLES[Math.min(node.depth, DEPTH_STYLES.length - 1)]
  const hasContent = node.children.length > 0 || node.summary
  return (
    <div className="mm-node-wrap" style={{ marginLeft: node.depth > 0 ? 20 : 0 }}>
      <div className="mm-node" style={{ background: st.bg, color: st.color, borderColor: st.border }}>
        <span className="mm-node-icon" onClick={() => hasContent && setOpen(x => !x)} style={{ cursor: hasContent ? 'pointer' : 'default' }}>
          {node.isLeaf ? '💡' : open ? '📂' : '📁'}
        </span>
        <span className="mm-node-title" onClick={() => hasContent && setOpen(x => !x)} style={{ cursor: hasContent ? 'pointer' : 'default' }}>
          {node.title}
        </span>
        <button className="mm-node-edit-btn" onClick={() => onEdit(node)} title="Edit node">✏️</button>
        {hasContent && (
          <span className="mm-node-chevron" onClick={() => setOpen(x => !x)}>{open ? '▲' : '▼'}</span>
        )}
      </div>
      {open && (
        <div className="mm-node-children">
          {node.summary && <div className="mm-node-summary">{node.summary}</div>}
          {node.children.map((child, i) => <ListMapNode key={i} node={child} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  )
}

// ── Arc Map (Style B) ─────────────────────────────────────────
const ARC_NW = 190   // node width
const ARC_NH = 40    // node height
const ARC_CG = 64    // column gap (horizontal)
const ARC_RH = 52    // row slot height

const ARC_COLORS = [
  { bg: '#6366f1', text: '#fff',        border: '#6366f1' },
  { bg: '#312e81', text: '#c7d2fe',     border: '#4f46e5' },
  { bg: '#1e1b4b', text: '#a5b4fc',     border: '#3730a3' },
  { bg: '#0f0c29', text: '#818cf8',     border: '#312e81' },
  { bg: '#080616', text: '#6366f1',     border: '#1e1b4b' },
]

function ArcMap({ tree, onEdit }) {
  const [expKeys, setExpKeys] = useState(() => {
    const s = new Set()
    function add(nodes, d) { if (d >= 1) return; for (const n of nodes) { s.add(n.key); add(n.children, d + 1) } }
    add(tree, 0); return s
  })

  function countSlots(node) {
    if (!expKeys.has(node.key) || node.children.length === 0) return 1
    return node.children.reduce((s, c) => s + countSlots(c), 0)
  }

  const { positions, totalW, totalH } = useMemo(() => {
    const pos = {}
    function layout(node, x, slotStart) {
      const slots = countSlots(node)
      const nodeY = slotStart * ARC_RH + (slots * ARC_RH - ARC_NH) / 2
      pos[node.key] = { x, y: nodeY }
      if (expKeys.has(node.key) && node.children.length > 0) {
        let cs = slotStart
        for (const child of node.children) {
          layout(child, x + ARC_NW + ARC_CG, cs)
          cs += countSlots(child)
        }
      }
    }
    let slot = 0
    for (const root of tree) { layout(root, 0, slot); slot += countSlots(root) + 0.5 }
    const vals = Object.values(pos)
    const w = vals.length ? Math.max(...vals.map(p => p.x)) + ARC_NW + 24 : 300
    const h = vals.length ? Math.max(...vals.map(p => p.y)) + ARC_NH + 24 : 200
    return { positions: pos, totalW: w, totalH: h }
  }, [tree, expKeys])

  const allNodes = useMemo(() => {
    const nodes = []
    function flatten(list, pk) {
      for (const n of list) {
        nodes.push({ ...n, parentKey: pk })
        if (expKeys.has(n.key)) flatten(n.children, n.key)
      }
    }
    flatten(tree, null)
    return nodes
  }, [tree, expKeys])

  function toggle(key) {
    setExpKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function expandAll() {
    const s = new Set()
    function add(nodes) { for (const n of nodes) { s.add(n.key); add(n.children) } }
    add(tree); setExpKeys(s)
  }
  function collapseAll() { setExpKeys(new Set()) }

  return (
    <div>
      <div className="arc-toolbar">
        <button className="btn-sm" onClick={expandAll}>Expand Semua</button>
        <button className="btn-sm" onClick={collapseAll}>Collapse Semua</button>
      </div>
      <div className="arc-scroll-wrap">
        <div style={{ position: 'relative', width: totalW, height: totalH, minWidth: '100%' }}>
          {/* SVG Edges */}
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={totalW} height={totalH}>
            <defs>
              <linearGradient id="arc-edge-grad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {allNodes.filter(n => n.parentKey && positions[n.key] && positions[n.parentKey]).map(n => {
              const from = positions[n.parentKey]
              const to   = positions[n.key]
              const x1 = from.x + ARC_NW, y1 = from.y + ARC_NH / 2
              const x2 = to.x,            y2 = to.y   + ARC_NH / 2
              const mx = (x1 + x2) / 2
              return (
                <path key={n.key}
                  d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                  fill="none" stroke="url(#arc-edge-grad)" strokeWidth={1.5}
                />
              )
            })}
          </svg>

          {/* HTML Nodes */}
          {allNodes.map(n => {
            if (!positions[n.key]) return null
            const { x, y } = positions[n.key]
            const c = ARC_COLORS[Math.min(n.depth, ARC_COLORS.length - 1)]
            const isExp = expKeys.has(n.key)
            const hasKids = n.children.length > 0
            const hiddenCount = !isExp && hasKids
              ? n.children.length
              : 0
            return (
              <div key={n.key} className="arc-node" style={{ left: x, top: y, width: ARC_NW, height: ARC_NH, background: c.bg, color: c.text, borderColor: c.border }}>
                <span className="arc-node-title" onClick={() => hasKids && toggle(n.key)} style={{ cursor: hasKids ? 'pointer' : 'default' }} title={n.title}>
                  {n.title}
                </span>
                <div className="arc-node-right">
                  {hiddenCount > 0 && <span className="arc-node-badge">{hiddenCount}</span>}
                  {hasKids && (
                    <span className="arc-node-toggle" onClick={() => toggle(n.key)}>{isExp ? '−' : '+'}</span>
                  )}
                  <button className="arc-node-edit-btn" onClick={() => onEdit(n)} title="Edit">✏️</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sheet view ────────────────────────────────────────────────
function SheetView({ rows, onAdd, onDelete, onUpdate, onSave, saving, dirty, readOnly, onImport, onTemplate }) {
  const fileRef = useRef()
  return (
    <div className="mm-sheet-wrap">
      {!readOnly && (
        <div className="mm-sheet-topbar">
          <button className="btn-sm" onClick={onTemplate}>⬇ Unduh Template XLSX</button>
          <button className="btn-sm" onClick={() => fileRef.current.click()}>📂 Import XLSX</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onImport} />
        </div>
      )}
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
                    <input className="mm-cell-input" value={row[lv] || ''} readOnly={readOnly} placeholder={readOnly ? '' : '—'}
                      onChange={e => !readOnly && onUpdate(i, lv, e.target.value)} />
                  </td>
                ))}
                <td>
                  <input className="mm-cell-input mm-cell-summary" value={row.summary || ''} readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Deskripsi…'}
                    onChange={e => !readOnly && onUpdate(i, 'summary', e.target.value)} />
                </td>
                {!readOnly && (
                  <td style={{ padding: '0 4px' }}>
                    <button className="mm-delete-btn" onClick={() => onDelete(i)}>×</button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="mm-sheet-empty">
                {readOnly ? 'Belum ada data.' : 'Belum ada baris. Import XLSX atau klik "+ Tambah Baris".'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="mm-sheet-actions">
          <button className="btn-sm" onClick={onAdd}>+ Tambah Baris</button>
          <button className={`btn-sm${dirty ? ' btn-sm-primary' : ''}`} onClick={onSave} disabled={saving || !dirty}>
            {saving ? 'Menyimpan…' : dirty ? '💾 Simpan' : '✓ Tersimpan'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function MindmapPage({ profile }) {
  const [domain, setDomain]             = useState('D2')
  const [mode, setMode]                 = useState('sheet')
  const [mapStyle, setMapStyle]         = useState('list')
  const [rows, setRows]                 = useState([emptyRow()])
  const [saving, setSaving]             = useState(false)
  const [dirty, setDirty]               = useState(false)
  const [students, setStudents]         = useState([])
  const [selectedStudent, setSelected]  = useState('')
  const [editingNode, setEditingNode]   = useState(null)
  const mapContainerRef                 = useRef()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isAdmin = profile.is_admin

  // Admin: load students
  useEffect(() => {
    if (!isAdmin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [isAdmin])

  // Load rows on domain / student change
  useEffect(() => { load() }, [domain, selectedStudent])

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  async function load() {
    if (isAdmin) {
      if (!selectedStudent) { setRows([]); return }
      const { data } = await supabase.rpc('get_student_mindmap_data', { p_user_id: selectedStudent, p_domain: domain })
      setRows(data ?? []); return
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
    setSaving(false); setDirty(false)
  }

  // XLSX import
  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const headerRow = data.find(row => row.some(c => /level\s*1/i.test(String(c))))
        if (!headerRow) { alert('Header tidak ditemukan. Pastikan file memiliki kolom Level 1 s/d Level 5 dan Summary.'); return }
        const fi = label => headerRow.findIndex(h => new RegExp(label, 'i').test(String(h)))
        const idx = { l1: fi('level\\s*1'), l2: fi('level\\s*2'), l3: fi('level\\s*3'), l4: fi('level\\s*4'), l5: fi('level\\s*5'), s: fi('summary') }
        const hi = data.indexOf(headerRow)
        const newRows = data.slice(hi + 1)
          .filter(row => row.some(c => String(c).trim()))
          .map(row => ({
            level1: String(row[idx.l1] ?? '').trim(), level2: String(row[idx.l2] ?? '').trim(),
            level3: String(row[idx.l3] ?? '').trim(), level4: String(row[idx.l4] ?? '').trim(),
            level5: String(row[idx.l5] ?? '').trim(), summary: String(row[idx.s] ?? '').trim(),
          }))
        if (!newRows.length) { alert('Tidak ada data di file.'); return }
        setRows(newRows); setDirty(true)
      } catch (err) { alert('Gagal membaca file: ' + err.message) }
      e.target.value = ''
    }
    reader.readAsBinaryString(file)
  }

  // XLSX template download
  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS)
    ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Mind Map')
    XLSX.writeFile(wb, `template_mindmap_${domain}.xlsx`)
  }

  // Node edit: update all matching rows
  function handleNodeEdit(newTitle, newSummary) {
    setRows(prev => {
      const updated = applyNodeEdit(prev, editingNode, newTitle, newSummary)
      setDirty(true)
      return updated
    })
    setEditingNode(null)
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) mapContainerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  const tree = useMemo(() => nestedToTree(rowsToNested(rows)), [rows])
  const showContent = !isAdmin || selectedStudent

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Mind Map IS Audit</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {isAdmin ? 'Lihat mind map mahasiswa' : 'Isi peta konsep IS Audit kamu'}
        </p>
      </div>

      {/* Admin: student picker */}
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <select className="mm-student-select" value={selectedStudent} onChange={e => setSelected(e.target.value)}>
            <option value="">— Pilih mahasiswa —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.npm} · {s.class})</option>)}
          </select>
        </div>
      )}

      {/* Domain tabs */}
      <div className="class-tabs" style={{ marginBottom: 0 }}>
        {DOMAINS.map(d => (
          <button key={d} className={`class-tab${domain === d ? ' active' : ''}`} onClick={() => setDomain(d)}>{d}</button>
        ))}
      </div>
      <div className="mm-domain-subtitle">{DOMAIN_TITLES[domain]}</div>

      {!showContent ? (
        <div className="empty-state"><div className="icon">👤</div><p>Pilih mahasiswa untuk melihat mind map.</p></div>
      ) : (
        <>
          {/* Mode tabs */}
          <div className="tabs">
            {!isAdmin && <button className={`tab-btn${mode === 'sheet' ? ' active' : ''}`} onClick={() => setMode('sheet')}>📋 Sheet</button>}
            <button className={`tab-btn${mode === 'map' ? ' active' : ''}`} onClick={() => setMode('map')}>🗺️ Mind Map</button>
            {isAdmin && <button className={`tab-btn${mode === 'sheet' ? ' active' : ''}`} onClick={() => setMode('sheet')}>📋 Sheet (preview)</button>}
          </div>

          {/* Sheet mode */}
          {mode === 'sheet' && (
            <SheetView rows={rows} onAdd={addRow} onDelete={deleteRow} onUpdate={updateRow}
              onSave={save} saving={saving} dirty={dirty} readOnly={isAdmin}
              onImport={handleImport} onTemplate={downloadTemplate} />
          )}

          {/* Map mode */}
          {mode === 'map' && (
            <div ref={mapContainerRef} className={`mm-map-outer${isFullscreen ? ' mm-map-fullscreen' : ''}`}>
              {/* Map toolbar */}
              <div className="mm-map-toolbar">
                <div className="mm-style-picker">
                  <button className={`mm-style-btn${mapStyle === 'list' ? ' active' : ''}`} onClick={() => setMapStyle('list')}>≡ List</button>
                  <button className={`mm-style-btn${mapStyle === 'arc' ? ' active' : ''}`} onClick={() => setMapStyle('arc')}>⬡ Arc</button>
                </div>
                <button className="mm-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Keluar fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? '⊡' : '⊞'}
                </button>
              </div>

              {/* Map content */}
              <div className="mm-map-content">
                {tree.length === 0 ? (
                  <div className="empty-state">
                    <div className="icon">🗺️</div>
                    <p>{isAdmin ? 'Belum ada data.' : 'Isi Sheet terlebih dahulu.'}</p>
                  </div>
                ) : mapStyle === 'list' ? (
                  tree.map((node, i) => <ListMapNode key={node.key || i} node={node} onEdit={setEditingNode} />)
                ) : (
                  <ArcMap key={domain + '_arc'} tree={tree} onEdit={setEditingNode} />
                )}
              </div>

              {/* Edit panel (docked inside map container) */}
              {editingNode && (
                <EditPanel node={editingNode} onClose={() => setEditingNode(null)} onSave={handleNodeEdit} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
