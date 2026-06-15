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
        <span>Edit node</span>
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

// ── Arc Map (Style B — left-rooted) ──────────────────────────
const ARC_NW = 190
const ARC_NH = 40
const ARC_CG = 64
const ARC_RH = 52

const ARC_COLORS = [
  { bg: '#6366f1', text: '#fff',    border: '#6366f1' },
  { bg: '#312e81', text: '#c7d2fe', border: '#4f46e5' },
  { bg: '#1e1b4b', text: '#a5b4fc', border: '#3730a3' },
  { bg: '#0f0c29', text: '#818cf8', border: '#312e81' },
  { bg: '#080616', text: '#6366f1', border: '#1e1b4b' },
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
          {allNodes.map(n => {
            if (!positions[n.key]) return null
            const { x, y } = positions[n.key]
            const c = ARC_COLORS[Math.min(n.depth, ARC_COLORS.length - 1)]
            const isExp = expKeys.has(n.key)
            const hasKids = n.children.length > 0
            const hiddenCount = !isExp && hasKids ? n.children.length : 0
            return (
              <div key={n.key} className="arc-node" style={{ left: x, top: y, width: ARC_NW, height: ARC_NH, background: c.bg, color: c.text, borderColor: c.border }}>
                <span className="arc-node-title" onClick={() => hasKids && toggle(n.key)} style={{ cursor: hasKids ? 'pointer' : 'default' }} title={n.title}>
                  {n.title}
                </span>
                <div className="arc-node-right">
                  {hiddenCount > 0 && <span className="arc-node-badge">{hiddenCount}</span>}
                  {hasKids && <span className="arc-node-toggle" onClick={() => toggle(n.key)}>{isExp ? '−' : '+'}</span>}
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

// ── Radial Map (Style C — center-rooted) ─────────────────────
const RAD_NW    = 150   // node width
const RAD_NH    = 36    // node height
const RAD_STEP  = 230   // radius increment per depth level

function RadialMap({ tree, onEdit, centerLabel = '' }) {
  const [expKeys, setExpKeys] = useState(() => {
    const s = new Set()
    function add(nodes, d) { if (d >= 1) return; for (const n of nodes) { s.add(n.key); add(n.children, d + 1) } }
    add(tree, 0); return s
  })

  function countSlots(node) {
    if (!expKeys.has(node.key) || node.children.length === 0) return 1
    return node.children.reduce((s, c) => s + countSlots(c), 0)
  }

  const { positions, totalW, totalH, cx, cy } = useMemo(() => {
    const total = tree.reduce((s, n) => s + countSlots(n), 0)
    if (!total) return { positions: {}, totalW: 300, totalH: 300, cx: 150, cy: 150 }

    // Minimum radius at depth 0 so nodes don't crowd each other
    const baseR = Math.max(180, tree.length * (RAD_NW + 20) / (2 * Math.PI))

    const pos = {}

    function layout(node, aStart, aEnd, depth) {
      const angle = (aStart + aEnd) / 2
      const r = baseR + depth * RAD_STEP
      pos[node.key] = { x: r * Math.cos(angle), y: r * Math.sin(angle) }
      if (!expKeys.has(node.key) || node.children.length === 0) return
      const childTotal = node.children.reduce((s, c) => s + countSlots(c), 0)
      let a = aStart
      for (const child of node.children) {
        const arc = (countSlots(child) / childTotal) * (aEnd - aStart)
        layout(child, a, a + arc, depth + 1)
        a += arc
      }
    }

    let a = 0
    for (const root of tree) {
      const arc = (countSlots(root) / total) * 2 * Math.PI
      layout(root, a, a + arc, 0)
      a += arc
    }

    const vals = Object.values(pos)
    const minX = Math.min(...vals.map(p => p.x)) - RAD_NW / 2 - 24
    const maxX = Math.max(...vals.map(p => p.x)) + RAD_NW / 2 + 24
    const minY = Math.min(...vals.map(p => p.y)) - RAD_NH / 2 - 24
    const maxY = Math.max(...vals.map(p => p.y)) + RAD_NH / 2 + 24

    return {
      positions: pos,
      totalW: maxX - minX,
      totalH: maxY - minY,
      cx: -minX,
      cy: -minY,
    }
  }, [tree, expKeys])

  const allNodes = useMemo(() => {
    const nodes = []
    function flatten(list, pk) {
      for (const n of list) { nodes.push({ ...n, parentKey: pk }); if (expKeys.has(n.key)) flatten(n.children, n.key) }
    }
    flatten(tree, null)
    return nodes
  }, [tree, expKeys])

  function toggle(key) {
    setExpKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function expandAll()  { const s = new Set(); function add(ns) { for (const n of ns) { s.add(n.key); add(n.children) } } add(tree); setExpKeys(s) }
  function collapseAll() { setExpKeys(new Set()) }

  return (
    <div>
      <div className="arc-toolbar">
        <button className="btn-sm" onClick={expandAll}>Expand Semua</button>
        <button className="btn-sm" onClick={collapseAll}>Collapse Semua</button>
      </div>
      <div className="arc-scroll-wrap" style={{ padding: 16 }}>
        <div style={{ position: 'relative', width: totalW, height: totalH, margin: '0 auto' }}>
          {/* SVG edges */}
          <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={totalW} height={totalH}>
            <defs>
              <linearGradient id="rad-edge-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {allNodes.filter(n => n.parentKey && positions[n.key] && positions[n.parentKey]).map(n => {
              const fp = positions[n.parentKey]
              const tp = positions[n.key]
              const x1 = cx + fp.x, y1 = cy + fp.y
              const x2 = cx + tp.x, y2 = cy + tp.y
              // Bezier control points pulled toward center
              const cpx = (x1 + x2) / 2 * 0.85 + cx * 0.15
              const cpy = (y1 + y2) / 2 * 0.85 + cy * 0.15
              return (
                <path key={n.key}
                  d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                  fill="none" stroke="url(#rad-edge-grad)" strokeWidth={1.5}
                />
              )
            })}
          </svg>

          {/* Center dot */}
          {centerLabel && (
            <div className="rad-center-dot" style={{ left: cx, top: cy }}>
              {centerLabel}
            </div>
          )}

          {/* Nodes */}
          {allNodes.map(n => {
            if (!positions[n.key]) return null
            const { x, y } = positions[n.key]
            const c = ARC_COLORS[Math.min(n.depth, ARC_COLORS.length - 1)]
            const isExp = expKeys.has(n.key)
            const hasKids = n.children.length > 0
            const hiddenCount = !isExp && hasKids ? n.children.length : 0
            return (
              <div key={n.key} className="arc-node" style={{
                left: cx + x, top: cy + y,
                width: RAD_NW, height: RAD_NH,
                transform: 'translate(-50%, -50%)',
                background: c.bg, color: c.text, borderColor: c.border,
              }}>
                <span className="arc-node-title" onClick={() => hasKids && toggle(n.key)} style={{ cursor: hasKids ? 'pointer' : 'default' }} title={n.title}>
                  {n.title}
                </span>
                <div className="arc-node-right">
                  {hiddenCount > 0 && <span className="arc-node-badge">{hiddenCount}</span>}
                  {hasKids && <span className="arc-node-toggle" onClick={() => toggle(n.key)}>{isExp ? '−' : '+'}</span>}
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
      {!readOnly && (onTemplate || onImport) && (
        <div className="mm-sheet-topbar">
          {onTemplate && <button className="btn-sm" onClick={onTemplate}>⬇ Unduh Template XLSX</button>}
          {onImport && (
            <>
              <button className="btn-sm" onClick={() => fileRef.current.click()}>Import XLSX</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onImport} />
            </>
          )}
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

// ── Group Manage Tab (admin) ──────────────────────────────────
function GroupManageTab({ domain }) {
  const [studs, StudsSet]     = useState([])
  const [groupMap, groupSet]  = useState({})          // userId → group_num
  const [numG, numGSet]       = useState({})          // className → n
  const [loaded, loadedSet]   = useState(false)
  const [saving, savingSet]   = useState(false)
  const [saved, savedSet]     = useState(false)

  useEffect(() => {
    loadedSet(false)
    supabase.rpc('admin_get_mindmap_groups', { p_domain: domain }).then(({ data }) => {
      const list = data ?? []
      studs.length && StudsSet([])  // reset
      StudsSet(list)
      const gm = {}, ng = {}
      for (const s of list) {
        if (s.group_num) gm[s.id] = s.group_num
        if (!ng[s.class]) ng[s.class] = 4
      }
      groupSet(gm)
      numGSet(ng)
      loadedSet(true)
      savedSet(false)
    })
  }, [domain])

  function setGroup(userId, val) {
    const n = parseInt(val) || 0
    groupSet(prev => {
      const next = { ...prev }
      if (n > 0) next[userId] = n; else delete next[userId]
      return next
    })
    savedSet(false)
  }

  function randomize(cls) {
    const clsStuds = studs.filter(s => s.class === cls)
    const n = numG[cls] || 4
    const shuffled = [...clsStuds].sort(() => Math.random() - 0.5)
    groupSet(prev => {
      const next = { ...prev }
      shuffled.forEach((s, i) => { next[s.id] = (i % n) + 1 })
      return next
    })
    savedSet(false)
  }

  async function save() {
    savingSet(true)
    const list = Object.entries(groupMap).map(([user_id, group_num]) => ({ user_id, group_num }))
    await supabase.rpc('admin_save_mindmap_groups', { p_domain: domain, p_assignments: list })
    savingSet(false)
    savedSet(true)
  }

  if (!loaded) return <div className="empty-state"><p>Memuat data mahasiswa…</p></div>

  const byClass = {}
  for (const s of studs) { if (!byClass[s.class]) byClass[s.class] = []; byClass[s.class].push(s) }

  return (
    <div className="mm-group-wrap">
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        Tentukan kelompok kolaborasi untuk Domain <strong>{domain}</strong>. Mahasiswa dalam kelompok yang sama akan berbagi mind map.
      </p>

      {Object.entries(byClass).map(([cls, list]) => (
        <div key={cls} className="mm-group-class-section">
          <div className="mm-group-class-header">
            <span>{cls}</span>
            <span className="mm-group-count">{list.length} mahasiswa</span>
          </div>

          <div className="mm-group-randomize-bar">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Acak menjadi</span>
            <input
              type="number" min="1" max="20" className="mm-group-n-input"
              value={numG[cls] || 4}
              onChange={e => numGSet(p => ({ ...p, [cls]: parseInt(e.target.value) || 4 }))}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>kelompok</span>
            <button className="btn-sm" onClick={() => randomize(cls)}>🎲 Acak!</button>
          </div>

          <div className="mm-group-table-wrap">
            <table className="mm-group-table">
              <thead>
                <tr><th>#</th><th>Nama</th><th>NPM</th><th>Kelompok</th></tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.id}>
                    <td className="mm-group-td-num">{i + 1}</td>
                    <td>{s.name}</td>
                    <td className="mm-group-td-npm">{s.npm}</td>
                    <td className="mm-group-td-group">
                      <input
                        type="number" min="0" max="20"
                        className="mm-group-num-input"
                        value={groupMap[s.id] || ''}
                        placeholder="—"
                        onChange={e => setGroup(s.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mm-group-save-bar">
        {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Tersimpan</span>}
        <button className="btn-sm btn-sm-primary" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan…' : '💾 Simpan Pengelompokan'}
        </button>
      </div>
    </div>
  )
}

// ── Group Collab Tab (student) ────────────────────────────────
function GroupCollabTab({ domain, profile }) {
  const [myGroup, myGroupSet]   = useState(null)
  const [rows, rowsSet]         = useState([])
  const [dirty, dirtySet]       = useState(false)
  const [saving, savingSet]     = useState(false)
  const [loading, loadingSet]   = useState(true)
  const [liveNote, liveNoteSet] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      loadingSet(true)
      const { data: grp } = await supabase.rpc('get_my_mindmap_group', { p_domain: domain })
      if (cancelled) return
      myGroupSet(grp ?? null)
      if (grp) {
        const { data: r } = await supabase.rpc('get_group_mindmap', { p_domain: domain })
        if (!cancelled) rowsSet(Array.isArray(r) && r.length ? r : [emptyRow()])
      }
      if (!cancelled) loadingSet(false)
    }
    init()
    return () => { cancelled = true }
  }, [domain])

  // Realtime subscription
  useEffect(() => {
    if (!myGroup) return
    const ch = supabase.channel(`grp-mm-${domain}-${myGroup.class}-${myGroup.group_num}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mindmap_group_data' }, payload => {
        const row = payload.new
        if (!row) return
        if (row.domain === domain && row.class === myGroup.class && row.group_num === myGroup.group_num) {
          if (row.updated_by !== profile.id) {
            rowsSet(Array.isArray(row.rows) ? row.rows : [])
            dirtySet(false)
            const name = myGroup.members?.find(m => m.npm)?.name ?? 'Anggota lain'
            liveNoteSet(`${name} baru saja memperbarui mind map kelompok`)
            setTimeout(() => liveNoteSet(null), 4000)
          }
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myGroup, domain])

  async function save() {
    savingSet(true)
    await supabase.rpc('save_group_mindmap', { p_domain: domain, p_rows: rows })
    savingSet(false)
    dirtySet(false)
  }

  function addRow()               { rowsSet(p => [...p, emptyRow()]); dirtySet(true) }
  function deleteRow(i)           { rowsSet(p => p.filter((_, j) => j !== i)); dirtySet(true) }
  function updateRow(i, fld, val) { rowsSet(p => p.map((r, j) => j === i ? { ...r, [fld]: val } : r)); dirtySet(true) }

  if (loading) return <div className="empty-state"><p>Memuat…</p></div>

  if (!myGroup) return (
    <div className="empty-state">
      <div className="icon">👥</div>
      <p>Belum ada pengelompokan untuk domain ini.</p>
      <p style={{ fontSize: 12, marginTop: 6 }}>Tunggu dosen menetapkan kelompok.</p>
    </div>
  )

  return (
    <div>
      <div className="mm-collab-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="mm-collab-group-badge">Kelompok {myGroup.group_num}</span>
          <span className="mm-collab-class">{myGroup.class}</span>
          {liveNote && <span className="mm-collab-live">{liveNote}</span>}
        </div>
        <div className="mm-collab-members">
          <span className="mm-collab-members-label">Anggota:</span>
          {(myGroup.members ?? []).map(m => (
            <span key={m.npm} className="mm-collab-member-chip">{m.name}</span>
          ))}
        </div>
      </div>

      <SheetView
        rows={rows}
        onAdd={addRow}
        onDelete={deleteRow}
        onUpdate={updateRow}
        onSave={save}
        saving={saving}
        dirty={dirty}
        readOnly={false}
        onImport={null}
        onTemplate={null}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function MindmapPage({ profile }) {
  const [domain, setDomain]           = useState('D2')
  const [mode, setMode]               = useState('sheet')
  const [mapStyle, setMapStyle]       = useState('list')
  const [arcCenter, setArcCenter]     = useState(false)
  const [rows, setRows]               = useState([emptyRow()])
  const [saving, setSaving]           = useState(false)
  const [dirty, setDirty]             = useState(false)
  const [students, setStudents]       = useState([])
  const [selectedStudent, setSelected] = useState('')
  const [editingNode, setEditingNode] = useState(null)
  const mapContainerRef               = useRef()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isAdmin = profile.is_admin

  useEffect(() => {
    if (!isAdmin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [isAdmin])

  useEffect(() => { load() }, [domain, selectedStudent])

  // Reset collab mode when domain changes and group doesn't exist
  useEffect(() => {
    if (mode === 'collab') setMode('sheet')
  }, [domain])

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

  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const headerRow = data.find(row => row.some(c => /level\s*1/i.test(String(c))))
        if (!headerRow) { alert('Header tidak ditemukan.'); return }
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

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS)
    ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Mind Map')
    XLSX.writeFile(wb, `template_mindmap_${domain}.xlsx`)
  }

  function handleNodeEdit(newTitle, newSummary) {
    setRows(prev => { const updated = applyNodeEdit(prev, editingNode, newTitle, newSummary); setDirty(true); return updated })
    setEditingNode(null)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) mapContainerRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  const tree        = useMemo(() => nestedToTree(rowsToNested(rows)), [rows])
  const showContent = mode === 'group' || !isAdmin || selectedStudent

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Mind Map IS Audit</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {isAdmin ? 'Kelola kelompok & lihat mind map mahasiswa' : 'Isi dan kolaborasikan peta konsep IS Audit'}
        </p>
      </div>

      {/* Admin: student picker — only for sheet/map modes */}
      {isAdmin && mode !== 'group' && (
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

      {/* Mode tabs */}
      <div className="tabs">
        {isAdmin ? (
          <>
            <button className={`tab-btn${mode === 'group'  ? ' active' : ''}`} onClick={() => setMode('group')}>👥 Kelola Kelompok</button>
            <button className={`tab-btn${mode === 'map'    ? ' active' : ''}`} onClick={() => setMode('map')}>🗺️ Mind Map</button>
            <button className={`tab-btn${mode === 'sheet'  ? ' active' : ''}`} onClick={() => setMode('sheet')}>📋 Sheet</button>
          </>
        ) : (
          <>
            <button className={`tab-btn${mode === 'sheet'  ? ' active' : ''}`} onClick={() => setMode('sheet')}>📋 Sheet</button>
            <button className={`tab-btn${mode === 'map'    ? ' active' : ''}`} onClick={() => setMode('map')}>🗺️ Mind Map</button>
            <button className={`tab-btn${mode === 'collab' ? ' active' : ''}`} onClick={() => setMode('collab')}>👥 Kolaborasi Kelompok</button>
          </>
        )}
      </div>

      {/* ── Group management (admin) ── */}
      {isAdmin && mode === 'group' && (
        <GroupManageTab key={domain} domain={domain} />
      )}

      {/* ── Group collab (student) ── */}
      {!isAdmin && mode === 'collab' && (
        <GroupCollabTab key={domain} domain={domain} profile={profile} />
      )}

      {/* ── Individual sheet / map ── */}
      {mode !== 'group' && mode !== 'collab' && (
        <>
          {!showContent ? (
            <div className="empty-state"><div className="icon">👤</div><p>Pilih mahasiswa untuk melihat mind map.</p></div>
          ) : (
            <>
              {/* Sheet mode */}
              {mode === 'sheet' && (
                <SheetView rows={rows} onAdd={addRow} onDelete={deleteRow} onUpdate={updateRow}
                  onSave={save} saving={saving} dirty={dirty} readOnly={isAdmin}
                  onImport={isAdmin ? null : handleImport}
                  onTemplate={isAdmin ? null : downloadTemplate} />
              )}

              {/* Map mode */}
              {mode === 'map' && (
                <div ref={mapContainerRef} className={`mm-map-outer${isFullscreen ? ' mm-map-fullscreen' : ''}`}>
                  <div className="mm-map-toolbar">
                    <div className="mm-style-picker">
                      <button className={`mm-style-btn${mapStyle === 'list' ? ' active' : ''}`} onClick={() => setMapStyle('list')}>≡ List</button>
                      <button className={`mm-style-btn${mapStyle === 'arc'  ? ' active' : ''}`} onClick={() => setMapStyle('arc')}>⬡ Arc</button>
                    </div>
                    {mapStyle === 'arc' && (
                      <button
                        className={`mm-style-btn${arcCenter ? ' active' : ''}`}
                        onClick={() => setArcCenter(x => !x)}
                        title={arcCenter ? 'Ganti ke layout kiri' : 'Ganti ke layout tengah'}
                      >
                        {arcCenter ? '⊙ Tengah' : '→ Kiri'}
                      </button>
                    )}
                    <button className="mm-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Keluar fullscreen' : 'Fullscreen'}>
                      {isFullscreen ? '⊡' : '⊞'}
                    </button>
                  </div>

                  <div className="mm-map-content">
                    {tree.length === 0 ? (
                      <div className="empty-state">
                        <div className="icon">🗺️</div>
                        <p>{isAdmin ? 'Belum ada data.' : 'Isi Sheet terlebih dahulu.'}</p>
                      </div>
                    ) : mapStyle === 'list' ? (
                      tree.map((node, i) => <ListMapNode key={node.key || i} node={node} onEdit={setEditingNode} />)
                    ) : arcCenter ? (
                      <RadialMap key={domain + '_radial'} tree={tree} onEdit={setEditingNode} centerLabel={domain} />
                    ) : (
                      <ArcMap key={domain + '_arc'} tree={tree} onEdit={setEditingNode} />
                    )}
                  </div>

                  {editingNode && (
                    <EditPanel node={editingNode} onClose={() => setEditingNode(null)} onSave={handleNodeEdit} />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
