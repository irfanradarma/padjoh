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

// ── AI grading defaults ───────────────────────────────────────
const DEFAULT_RUBRIC = {
  criteria: [
    { name: 'Kelengkapan Topik',  max_score: 30, description: 'Seberapa lengkap topik IS Audit untuk domain ini tercakup dalam mind map' },
    { name: 'Struktur Hierarki',  max_score: 25, description: 'Kualitas organisasi hierarki dan keterhubungan antar node' },
    { name: 'Kedalaman Analisis', max_score: 25, description: 'Tingkat detail dan kedalaman pada setiap cabang mind map' },
    { name: 'Akurasi Konten',     max_score: 20, description: 'Kebenaran dan relevansi konten sesuai standar IS Audit' },
  ],
}

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

// ── Spreadsheet view ─────────────────────────────────────────
const SS_COLS    = ['level1', 'level2', 'level3', 'level4', 'level5', 'summary']
const SS_HEADERS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Summary']
const SS_WIDTHS  = ['18%', '18%', '16%', '14%', '12%', '22%']
const MIN_ROWS   = 50

function padGrid(rows) {
  const g = (rows ?? []).map(r => ({ ...r }))
  while (g.length < MIN_ROWS) g.push(emptyRow())
  return g
}
function trimGrid(grid) {
  let last = grid.length - 1
  while (last > 0 && SS_COLS.every(k => !(grid[last][k] ?? '').trim())) last--
  return grid.slice(0, last + 1)
}

const SS_DEFAULT_WIDTHS = [150, 150, 130, 120, 100, 200]

function SheetView({ initialRows, onSave, saving, readOnly, domain }) {
  const [grid, setGrid]         = useState(() => padGrid(initialRows))
  const [dirty, setDirty]       = useState(false)
  const [anchor, setAnchor]     = useState({ r: 0, c: 0 })
  const [focus, setFocus]       = useState({ r: 0, c: 0 })
  const [editing, setEditing]   = useState(false)
  const [addN, setAddN]         = useState(100)
  const [colWidths, setColWidths] = useState(SS_DEFAULT_WIDTHS)
  const [isSheetFs, setSheetFs] = useState(false)

  const tabbing      = useRef(false)  // suppress blur during Tab/Enter cell navigation
  const dragging     = useRef(false)
  const colResizing  = useRef(null)   // { col, startX, startW }
  const containerRef = useRef()
  const sheetOuterRef = useRef()
  const inputRefs    = useRef({})     // `${r}_${c}` → <input>
  const fileRef      = useRef()
  const prevRows     = useRef(initialRows)

  // Sync when parent pushes new rows (realtime update or domain change)
  useEffect(() => {
    if (prevRows.current === initialRows) return
    prevRows.current = initialRows
    setGrid(padGrid(initialRows))
    setDirty(false)
    setEditing(false)
  }, [initialRows])

  // Focus the active input after anchor/editing change
  useEffect(() => {
    if (!editing) return
    const input = inputRefs.current[`${anchor.r}_${anchor.c}`]
    if (input) {
      input.focus()
      const len = input.value.length
      input.setSelectionRange(len, len)
      tabbing.current = false
    }
  }, [editing, anchor.r, anchor.c])

  // Column resize mouse handlers
  useEffect(() => {
    function onMove(e) {
      if (!colResizing.current) return
      const { col, startX, startW } = colResizing.current
      const newW = Math.max(60, startW + e.clientX - startX)
      setColWidths(prev => prev.map((w, i) => i === col ? newW : w))
    }
    function onUp() { colResizing.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Fullscreen change listener for the sheet
  useEffect(() => {
    const handler = () => setSheetFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const sel = {
    r1: Math.min(anchor.r, focus.r), c1: Math.min(anchor.c, focus.c),
    r2: Math.max(anchor.r, focus.r), c2: Math.max(anchor.c, focus.c),
  }
  const inSel = (r, c) => r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2

  function moveTo(r, c, extend = false) {
    const nr = Math.max(0, Math.min(r, grid.length - 1))
    const nc = Math.max(0, Math.min(c, SS_COLS.length - 1))
    if (extend) { setFocus({ r: nr, c: nc }) }
    else { setAnchor({ r: nr, c: nc }); setFocus({ r: nr, c: nc }) }
  }

  function handleMouseDown(e, r, c) {
    if (editing && anchor.r === r && anchor.c === c) return
    e.preventDefault()
    setEditing(false)
    if (e.shiftKey) { setFocus({ r, c }) }
    else { setAnchor({ r, c }); setFocus({ r, c }); dragging.current = true }
    containerRef.current?.focus()
  }

  function handleMouseEnter(r, c) { if (dragging.current) setFocus({ r, c }) }

  function handleDoubleClick(r, c) {
    if (readOnly) return
    setAnchor({ r, c }); setFocus({ r, c }); setEditing(true)
  }

  function clearSel() {
    const g = grid.map(row => ({ ...row }))
    for (let r = sel.r1; r <= sel.r2; r++)
      for (let c = sel.c1; c <= sel.c2; c++)
        g[r] = { ...g[r], [SS_COLS[c]]: '' }
    setGrid(g); setDirty(true)
  }

  function handleKeyDown(e) {
    if (editing) {
      switch (e.key) {
        case 'Escape':
          e.preventDefault(); setEditing(false); containerRef.current?.focus(); return
        case 'Tab': {
          e.preventDefault(); tabbing.current = true
          let nr = anchor.r, nc = e.shiftKey ? anchor.c - 1 : anchor.c + 1
          if (nc < 0) { nr--; nc = SS_COLS.length - 1 }
          else if (nc >= SS_COLS.length) { nr++; nc = 0 }
          nr = Math.max(0, Math.min(nr, grid.length - 1))
          nc = Math.max(0, Math.min(nc, SS_COLS.length - 1))
          setAnchor({ r: nr, c: nc }); setFocus({ r: nr, c: nc }); return
        }
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault(); tabbing.current = true
            const nr = Math.min(anchor.r + 1, grid.length - 1)
            setAnchor({ r: nr, c: anchor.c }); setFocus({ r: nr, c: anchor.c })
          }
          return
        default: return
      }
    }
    // Not editing:
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveTo(anchor.r - 1, anchor.c, e.shiftKey); break
      case 'ArrowDown':  e.preventDefault(); moveTo(anchor.r + 1, anchor.c, e.shiftKey); break
      case 'ArrowLeft':  e.preventDefault(); moveTo(anchor.r, anchor.c - 1, e.shiftKey); break
      case 'ArrowRight': e.preventDefault(); moveTo(anchor.r, anchor.c + 1, e.shiftKey); break
      case 'Tab':
        e.preventDefault(); moveTo(anchor.r, e.shiftKey ? anchor.c - 1 : anchor.c + 1); break
      case 'Enter': case 'F2':
        if (!readOnly) { e.preventDefault(); setEditing(true) } break
      case 'Delete': case 'Backspace':
        if (!readOnly) { e.preventDefault(); clearSel() } break
      case 'Escape': setFocus({ ...anchor }); break
      default:
        if (!readOnly && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          const g = grid.map(row => ({ ...row }))
          g[anchor.r] = { ...g[anchor.r], [SS_COLS[anchor.c]]: e.key }
          setGrid(g); setDirty(true); setEditing(true)
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault()
          setAnchor({ r: 0, c: 0 }); setFocus({ r: grid.length - 1, c: SS_COLS.length - 1 })
        }
    }
  }

  function handleCopy(e) {
    if (editing && sel.r1 === sel.r2 && sel.c1 === sel.c2) return
    e.preventDefault()
    const lines = []
    for (let r = sel.r1; r <= sel.r2; r++) {
      const cells = []
      for (let c = sel.c1; c <= sel.c2; c++) cells.push(grid[r]?.[SS_COLS[c]] ?? '')
      lines.push(cells.join('\t'))
    }
    e.clipboardData.setData('text/plain', lines.join('\n'))
  }

  function handlePaste(e) {
    if (readOnly) return
    const text = e.clipboardData.getData('text/plain')
    const pasteRows = text.split(/\r?\n/)
    if (pasteRows[pasteRows.length - 1] === '') pasteRows.pop()
    const parsed = pasteRows.map(l => l.split('\t'))
    if (editing && parsed.length === 1 && parsed[0].length === 1) return
    e.preventDefault()
    const g = grid.map(row => ({ ...row }))
    parsed.forEach((pRow, dr) => {
      const r = anchor.r + dr
      while (g.length <= r) g.push(emptyRow())
      pRow.forEach((val, dc) => {
        const c = anchor.c + dc
        if (c < SS_COLS.length) g[r] = { ...g[r], [SS_COLS[c]]: val }
      })
    })
    while (g.length < MIN_ROWS) g.push(emptyRow())
    setGrid(g); setDirty(true)
    setFocus({
      r: Math.min(anchor.r + parsed.length - 1, g.length - 1),
      c: Math.min(anchor.c + Math.max(...parsed.map(r => r.length)) - 1, SS_COLS.length - 1),
    })
  }

  function updateCell(r, c, val) {
    const g = grid.map(row => ({ ...row }))
    g[r] = { ...g[r], [SS_COLS[c]]: val }
    if (r >= g.length - 5) while (g.length < r + 10) g.push(emptyRow())
    setGrid(g); setDirty(true)
  }

  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const hrow = data.find(row => row.some(c => /level\s*1/i.test(String(c))))
        if (!hrow) { alert('Header tidak ditemukan.'); return }
        const fi = lbl => hrow.findIndex(h => new RegExp(lbl, 'i').test(String(h)))
        const idx = { l1: fi('level\\s*1'), l2: fi('level\\s*2'), l3: fi('level\\s*3'), l4: fi('level\\s*4'), l5: fi('level\\s*5'), s: fi('summary') }
        const hi = data.indexOf(hrow)
        const newRows = data.slice(hi + 1).filter(row => row.some(c => String(c).trim()))
          .map(row => ({
            level1: String(row[idx.l1] ?? '').trim(), level2: String(row[idx.l2] ?? '').trim(),
            level3: String(row[idx.l3] ?? '').trim(), level4: String(row[idx.l4] ?? '').trim(),
            level5: String(row[idx.l5] ?? '').trim(), summary: String(row[idx.s] ?? '').trim(),
          }))
        if (!newRows.length) { alert('Tidak ada data di file.'); return }
        setGrid(padGrid(newRows)); setDirty(true)
      } catch (err) { alert('Gagal membaca file: ' + err.message) }
      e.target.value = ''
    }
    reader.readAsBinaryString(file)
  }

  function handleTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS)
    ws['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Mind Map')
    XLSX.writeFile(wb, `template_mindmap_${domain ?? ''}.xlsx`)
  }

  function doSave() { onSave(trimGrid(grid)) }

  function handleDownload() {
    const data = trimGrid(grid)
    const aoa  = [SS_HEADERS, ...data.map(r => SS_COLS.map(c => r[c] || ''))]
    const wb   = XLSX.utils.book_new()
    const ws   = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = colWidths.map(w => ({ wch: Math.round(w / 7) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Mind Map')
    XLSX.writeFile(wb, `mindmap_${domain ?? 'sheet'}.xlsx`)
  }

  function toggleSheetFullscreen() {
    if (!document.fullscreenElement) sheetOuterRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  return (
    <div
      ref={sheetOuterRef}
      className={`ss-outer${isSheetFs ? ' ss-fullscreen' : ''}`}
    >
    <div
      ref={containerRef}
      className="ss-inner"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseUp={() => { dragging.current = false }}
      onCopy={handleCopy}
      onPaste={handlePaste}
    >
      {!readOnly && (
        <div className="ss-toolbar">
          <button className="btn-sm" onClick={handleTemplate}>⬇ Template</button>
          <button className="btn-sm" onClick={() => fileRef.current.click()}>📂 Import XLSX</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <div style={{ flex: 1 }} />
          <button className="btn-sm" onClick={handleDownload} title="Unduh sheet sebagai XLSX">📥 Unduh XLSX</button>
          <button className="btn-sm ss-fs-btn" onClick={toggleSheetFullscreen} title={isSheetFs ? 'Keluar fullscreen' : 'Fullscreen'}>
            {isSheetFs ? '⊡' : '⊞'}
          </button>
          <button className={`btn-sm${dirty ? ' btn-sm-primary' : ''}`} onClick={doSave} disabled={saving || !dirty}>
            {saving ? 'Menyimpan…' : dirty ? '💾 Simpan' : '✓ Tersimpan'}
          </button>
        </div>
      )}
      {readOnly && (
        <div className="ss-toolbar">
          <div style={{ flex: 1 }} />
          <button className="btn-sm" onClick={handleDownload} title="Unduh sheet sebagai XLSX">📥 Unduh XLSX</button>
          <button className="btn-sm ss-fs-btn" onClick={toggleSheetFullscreen} title={isSheetFs ? 'Keluar fullscreen' : 'Fullscreen'}>
            {isSheetFs ? '⊡' : '⊞'}
          </button>
        </div>
      )}

      <div className="ss-scroll">
        <table className="ss-table" onMouseLeave={() => { dragging.current = false }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="ss-th-corner" />
              {SS_HEADERS.map((h, c) => (
                <th key={c} className={`ss-th${c >= sel.c1 && c <= sel.c2 ? ' ss-th-sel' : ''}`}>
                  <span className="ss-th-label">{h}</span>
                  <span
                    className="ss-col-resize-handle"
                    onMouseDown={e => {
                      e.stopPropagation()
                      colResizing.current = { col: c, startX: e.clientX, startW: colWidths[c] }
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const rowSel = r >= sel.r1 && r <= sel.r2
              return (
                <tr key={r}>
                  <td className={`ss-rn${rowSel ? ' ss-rn-sel' : ''}`}>{r + 1}</td>
                  {SS_COLS.map((col, c) => {
                    const isAnchor   = anchor.r === r && anchor.c === c
                    const isEditCell = editing && isAnchor
                    return (
                      <td
                        key={c}
                        className={`ss-cell${inSel(r, c) ? ' ss-sel' : ''}${isAnchor && !isEditCell ? ' ss-anchor' : ''}`}
                        onMouseDown={e => handleMouseDown(e, r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        onDoubleClick={() => handleDoubleClick(r, c)}
                      >
                        {isEditCell
                          ? <input
                              ref={el => { inputRefs.current[`${r}_${c}`] = el }}
                              className="ss-input"
                              value={row[col] || ''}
                              onChange={e => updateCell(r, c, e.target.value)}
                              onBlur={() => { if (tabbing.current) return; setEditing(false) }}
                            />
                          : <span className="ss-val">{row[col] || ''}</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="ss-add-row-bar">
          <span className="ss-hint">Tambah</span>
          <input
            type="number" min="1" max="1000"
            className="ss-add-n"
            value={addN}
            onChange={e => setAddN(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <span className="ss-hint">baris baru</span>
          <button className="btn-sm" onClick={() => {
            setGrid(g => [...g, ...Array.from({ length: addN }, emptyRow)])
            setDirty(true)
          }}>Tambah</button>
        </div>
      )}

      <div className="ss-footer">
        <span className="ss-hint">
          {readOnly
            ? 'Klik sel · Ctrl+C: salin'
            : 'Enter/F2: edit · Tab: kolom berikut · Del: hapus · Ctrl+C/V: salin/tempel dari spreadsheet'}
        </span>
        {!readOnly && (
          <button className={`btn-sm${dirty ? ' btn-sm-primary' : ''}`} onClick={doSave} disabled={saving || !dirty}>
            {saving ? 'Menyimpan…' : dirty ? '💾 Simpan' : '✓ Tersimpan'}
          </button>
        )}
      </div>
    </div>
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

// ── Rubric editor (admin) ─────────────────────────────────────
function RubricEditor({ rubric, onChange }) {
  const total = rubric.criteria.reduce((s, c) => s + Number(c.max_score || 0), 0)

  function update(i, field, val) {
    onChange({
      ...rubric,
      criteria: rubric.criteria.map((c, j) =>
        j === i ? { ...c, [field]: field === 'max_score' ? Number(val) : val } : c
      ),
    })
  }

  return (
    <div className="gr-rubric-editor">
      <div className="gr-rubric-total-row">
        <span className="gr-rubric-sub">Edit rubrik sebelum menilai.</span>
        <span className={`gr-rubric-total${total !== 100 ? ' gr-rubric-warn' : ''}`}>Total: {total} / 100</span>
      </div>
      {rubric.criteria.map((c, i) => (
        <div key={i} className="gr-rubric-row">
          <div className="gr-rubric-top">
            <input className="input gr-rubric-name" value={c.name}
              onChange={e => update(i, 'name', e.target.value)} placeholder="Nama kriteria" />
            <div className="gr-rubric-score-wrap">
              <input type="number" min="0" max="100" className="input gr-rubric-score"
                value={c.max_score} onChange={e => update(i, 'max_score', e.target.value)} />
              <span className="gr-rubric-pts">pts</span>
            </div>
          </div>
          <input className="input gr-rubric-desc" value={c.description}
            onChange={e => update(i, 'description', e.target.value)} placeholder="Deskripsi kriteria" />
        </div>
      ))}
    </div>
  )
}

// ── Grade tab (admin) ─────────────────────────────────────────
function GradeTab({ domain }) {
  const [rubric, setRubric]         = useState(DEFAULT_RUBRIC)
  const [rubricOpen, setRubricOpen] = useState(false)
  const [groups, setGroups]         = useState([])
  const [grades, setGrades]         = useState([])
  const [assessing, setAssessing]   = useState(null) // { class, group_num } | null
  const [assessErr, setAssessErr]   = useState(null)
  const [gradeModal, setGradeModal] = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => { loadAll() }, [domain])

  async function loadAll() {
    setLoading(true)
    const [{ data: studs }, { data: gr }] = await Promise.all([
      supabase.rpc('admin_get_mindmap_groups', { p_domain: domain }),
      supabase.rpc('admin_get_mindmap_grades', { p_domain: domain }),
    ])
    const groupMap = {}
    for (const s of (studs ?? [])) {
      if (!s.group_num) continue
      const key = `${s.class}__${s.group_num}`
      if (!groupMap[key]) groupMap[key] = { class: s.class, group_num: s.group_num, members: [] }
      groupMap[key].members.push(s)
    }
    setGroups(Object.values(groupMap).sort((a, b) =>
      a.class.localeCompare(b.class) || a.group_num - b.group_num
    ))
    setGrades(Array.isArray(gr) ? gr : [])
    setLoading(false)
  }

  function gradeOf(cls, groupNum) {
    return grades.find(g => g.class === cls && g.group_num === groupNum && g.grade != null)
  }

  async function runAssessment(cls, groupNum) {
    const { data: rows, error: rowErr } = await supabase.rpc('admin_get_group_mindmap_data', {
      p_domain: domain, p_class: cls, p_group_num: groupNum,
    })
    if (rowErr) throw new Error(rowErr.message)

    const { data: result, error: fnErr } = await supabase.functions.invoke('assess-mindmap', {
      body: { rows: rows ?? [], rubric, domain },
    })
    if (fnErr) throw new Error(fnErr.message)
    if (result?.error) throw new Error(result.error)

    const { error: saveErr } = await supabase.rpc('admin_save_mindmap_grade', {
      p_domain: domain, p_class: cls, p_group_num: groupNum,
      p_grade: result.total_score,
      p_explanation: JSON.stringify(result),
      p_rubric: rubric,
    })
    if (saveErr) throw new Error(saveErr.message)
  }

  async function assessGroup(cls, groupNum) {
    setAssessErr(null)
    setAssessing({ class: cls, group_num: groupNum })
    try {
      await runAssessment(cls, groupNum)
      await loadAll()
    } catch (err) {
      setAssessErr(`Kelompok ${cls}-${groupNum}: ${err.message}`)
    }
    setAssessing(null)
  }

  async function assessAll() {
    setAssessErr(null)
    for (const g of groups) {
      setAssessing({ class: g.class, group_num: g.group_num })
      try {
        await runAssessment(g.class, g.group_num)
      } catch (err) {
        setAssessErr(`Kelompok ${g.class}-${g.group_num}: ${err.message}`)
      }
    }
    await loadAll()
    setAssessing(null)
  }

  const isBusy = assessing !== null

  if (gradeModal) {
    let parsed = null
    try { parsed = JSON.parse(gradeModal.explanation) } catch {}
    return (
      <div className="pw-overlay">
        <div className="pw-modal gr-modal">
          <h3 className="pw-modal-title">
            {gradeModal.name} · Kelompok {gradeModal.group_num} · Nilai {gradeModal.grade}
          </h3>
          {parsed ? (
            <>
              <table className="gr-score-table">
                <thead><tr><th>Kriteria</th><th>Skor</th><th>Maks</th><th>Komentar</th></tr></thead>
                <tbody>
                  {(parsed.scores ?? []).map((s, i) => (
                    <tr key={i}>
                      <td>{s.criterion}</td>
                      <td className="gr-score-val">{s.score}</td>
                      <td className="gr-score-max">/{s.max_score}</td>
                      <td>{s.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.summary && <p className="gr-summary">{parsed.summary}</p>}
            </>
          ) : (
            <p className="gr-raw-explanation">{gradeModal.explanation}</p>
          )}
          <div className="pw-modal-btns">
            <button className="btn btn-primary" onClick={() => setGradeModal(null)}>Tutup</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state"><p>Memuat data kelompok…</p></div>

  const byClass = {}
  for (const g of groups) {
    if (!byClass[g.class]) byClass[g.class] = []
    byClass[g.class].push(g)
  }
  const gradedStudents = grades.filter(g => g.grade != null)

  return (
    <div className="gr-wrap">
      <div className="gr-rubric-section">
        <button className="gr-rubric-toggle" onClick={() => setRubricOpen(x => !x)}>
          📋 Rubrik Penilaian {rubricOpen ? '▲' : '▼'}
        </button>
        {rubricOpen && (
          <div className="gr-rubric-body">
            <RubricEditor rubric={rubric} onChange={setRubric} />
            <button className="btn-sm" style={{ marginTop: 10 }} onClick={() => setRubric(DEFAULT_RUBRIC)}>
              ↺ Reset ke Default
            </button>
          </div>
        )}
      </div>

      {assessErr && <div className="um-load-err">{assessErr}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <p>Belum ada kelompok untuk domain <strong>{domain}</strong>.<br />
            Atur kelompok di tab "Kelola Kelompok" terlebih dahulu.</p>
        </div>
      ) : (
        <>
          <div className="gr-group-section">
            <div className="gr-group-header">
              <span className="gr-section-title">Kelompok Domain {domain}</span>
              <button className="btn btn-primary gr-assess-all-btn" onClick={assessAll} disabled={isBusy}>
                {isBusy ? '⏳ Menilai…' : '🤖 Nilai Semua Kelompok'}
              </button>
            </div>

            {Object.entries(byClass).map(([cls, clsGroups]) => (
              <div key={cls} className="gr-class-section">
                <div className="gr-class-header">{cls}</div>
                <div className="gr-group-list">
                  {clsGroups.map(grp => {
                    const existing = gradeOf(cls, grp.group_num)
                    const thisBusy = assessing?.class === cls && assessing?.group_num === grp.group_num
                    return (
                      <div key={grp.group_num} className="gr-group-card">
                        <div className="gr-group-info">
                          <span className="gr-group-label">Kelompok {grp.group_num}</span>
                          <span className="gr-group-members">{grp.members.map(m => m.name).join(', ')}</span>
                        </div>
                        <div className="gr-group-right">
                          {existing && <span className="gr-grade-badge">{existing.grade}</span>}
                          <button className="btn-sm btn-sm-primary"
                            onClick={() => assessGroup(cls, grp.group_num)} disabled={isBusy}>
                            {thisBusy ? '⏳…' : existing ? '↺ Nilai Ulang' : '🤖 Nilai'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {gradedStudents.length > 0 && (
            <div className="gr-results-section">
              <div className="gr-section-title">Rekap Nilai Mahasiswa</div>
              <div className="ll-table-wrap">
                <table className="um-table gr-grade-table">
                  <thead>
                    <tr><th>Nama</th><th>NPM</th><th>Kelas</th><th>Kelompok</th><th>Nilai</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {gradedStudents.map(g => (
                      <tr key={g.student_id}>
                        <td>{g.name}</td>
                        <td className="um-td-npm">{g.npm}</td>
                        <td>{g.class}</td>
                        <td style={{ textAlign: 'center' }}>{g.group_num ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}><span className="gr-grade-chip">{g.grade}</span></td>
                        <td><button className="um-btn-sm" onClick={() => setGradeModal(g)}>📋 Lihat</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
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
  const [students, setStudents]       = useState([])
  const [selectedStudent, setSelected] = useState('')
  const [editingNode, setEditingNode] = useState(null)
  const mapContainerRef               = useRef()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [myGroup, setMyGroup]   = useState(null)
  const [liveNote, setLiveNote] = useState(null)

  const isAdmin = profile.is_admin

  useEffect(() => {
    if (!isAdmin) return
    supabase.rpc('get_students').then(({ data }) => setStudents(data ?? []))
  }, [isAdmin])

  useEffect(() => { load() }, [domain, selectedStudent])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    if (isAdmin || !myGroup) return
    const ch = supabase.channel(`grp-mm-${domain}-${myGroup.class}-${myGroup.group_num}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mindmap_group_data' }, payload => {
        const row = payload.new
        if (!row || row.domain !== domain || row.class !== myGroup.class || row.group_num !== myGroup.group_num) return
        if (row.updated_by !== profile.id) {
          setRows(Array.isArray(row.rows) ? row.rows : [])
          setLiveNote('Anggota lain baru saja memperbarui sheet')
          setTimeout(() => setLiveNote(null), 4000)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myGroup, domain, isAdmin])

  async function load() {
    if (isAdmin) {
      if (!selectedStudent) { setRows([]); return }
      const { data } = await supabase.rpc('get_student_mindmap_data', { p_user_id: selectedStudent, p_domain: domain })
      setRows(data ?? []); return
    }
    const { data: grp } = await supabase.rpc('get_my_mindmap_group', { p_domain: domain })
    setMyGroup(grp ?? null)
    if (grp) {
      const { data } = await supabase.rpc('get_group_mindmap', { p_domain: domain })
      setRows(Array.isArray(data) && data.length ? data : [emptyRow()])
    } else {
      const { data } = await supabase.rpc('get_my_mindmap', { p_domain: domain })
      setRows(data ?? [emptyRow()])
    }
  }

  async function save(newRows) {
    setSaving(true)
    setRows(newRows)
    if (myGroup) {
      await supabase.rpc('save_group_mindmap', { p_domain: domain, p_rows: newRows })
    } else {
      await supabase.rpc('save_mindmap', { p_domain: domain, p_rows: newRows })
    }
    setSaving(false)
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
  const showContent = !isAdmin || selectedStudent

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Mind Map IS Audit</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          {isAdmin ? 'Kelola kelompok & lihat mind map mahasiswa' : 'Isi dan kolaborasikan peta konsep IS Audit'}
        </p>
      </div>

      {/* Admin: student picker — only for sheet/map modes */}
      {isAdmin && mode !== 'group' && mode !== 'grade' && (
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
            <button className={`tab-btn${mode === 'grade'  ? ' active' : ''}`} onClick={() => setMode('grade')}>🎯 Penilaian AI</button>
          </>
        ) : (
          <>
            <button className={`tab-btn${mode === 'sheet'  ? ' active' : ''}`} onClick={() => setMode('sheet')}>📋 Sheet</button>
            <button className={`tab-btn${mode === 'map'    ? ' active' : ''}`} onClick={() => setMode('map')}>🗺️ Mind Map</button>
          </>
        )}
      </div>

      {/* ── Group management (admin) ── */}
      {isAdmin && mode === 'group' && (
        <GroupManageTab key={domain} domain={domain} />
      )}

      {/* ── AI grading (admin) ── */}
      {isAdmin && mode === 'grade' && (
        <GradeTab key={domain} domain={domain} />
      )}

      {/* ── Sheet / map ── */}
      {mode !== 'group' && mode !== 'grade' && (
        <>
          {!showContent ? (
            <div className="empty-state"><div className="icon">👤</div><p>Pilih mahasiswa untuk melihat mind map.</p></div>
          ) : (
            <>
              {/* Group banner shown when student is in a group */}
              {!isAdmin && myGroup && (
                <div className="mm-collab-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="mm-collab-group-badge">Kelompok {myGroup.group_num}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{myGroup.class}</span>
                    {liveNote && <span className="mm-collab-live">{liveNote}</span>}
                  </div>
                  <div className="mm-collab-members">
                    <span className="mm-collab-members-label">Anggota:</span>
                    {(myGroup.members ?? []).map(m => (
                      <span key={m.npm} className="mm-collab-member-chip">{m.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sheet mode */}
              {mode === 'sheet' && (
                <SheetView
                  initialRows={rows}
                  onSave={save}
                  saving={saving}
                  readOnly={isAdmin}
                  domain={domain}
                />
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
