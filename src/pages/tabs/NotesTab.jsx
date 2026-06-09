import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function newTextBlock() { return { id: genId(), type: 'text', html: '' } }

function parseBlocks(content) {
  if (!content) return [newTextBlock()]
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  // legacy plain text
  return [{ id: genId(), type: 'text', html: content }]
}

// ── Rich-text block ─────────────────────────────────────────
const TOOLBAR = [
  { label: 'H1', cmd: 'formatBlock', val: 'h1' },
  { label: 'H2', cmd: 'formatBlock', val: 'h2' },
  { label: 'H3', cmd: 'formatBlock', val: 'h3' },
  null,
  { label: 'B',  cmd: 'bold',        style: { fontWeight: 700 } },
  { label: 'I',  cmd: 'italic',      style: { fontStyle: 'italic' } },
  { label: 'U',  cmd: 'underline',   style: { textDecoration: 'underline' } },
  null,
  { label: '• List',  cmd: 'insertUnorderedList' },
  { label: '1. List', cmd: 'insertOrderedList'   },
  null,
  { label: 'Clear', cmd: 'removeFormat' },
]

function RichBlock({ block, loadKey, onChange, onDelete }) {
  const editorRef   = useRef()
  const initializedRef = useRef(false)

  // Set innerHTML once on mount / when loadKey changes (section navigation)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = block.html || ''
      initializedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey])

  function exec(cmd, val = null) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange({ ...block, html: editorRef.current?.innerHTML ?? '' })
  }

  return (
    <div className="note-block">
      <div className="note-block-toolbar">
        {TOOLBAR.map((btn, i) =>
          btn === null
            ? <span key={i} className="toolbar-sep" />
            : (
              <button
                key={i}
                className="toolbar-btn"
                style={btn.style}
                title={btn.label}
                onMouseDown={e => { e.preventDefault(); exec(btn.cmd, btn.val ?? null) }}
              >
                {btn.label}
              </button>
            )
        )}
        <button
          className="toolbar-btn toolbar-delete"
          title="Hapus blok"
          onMouseDown={e => { e.preventDefault(); onDelete() }}
        >✕</button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Tulis catatan di sini…"
        onInput={() => onChange({ ...block, html: editorRef.current?.innerHTML ?? '' })}
      />
    </div>
  )
}

// ── File block ──────────────────────────────────────────────
function FileBlock({ block, onDelete }) {
  async function download() {
    const { data } = await supabase.storage.from('exercises').createSignedUrl(block.path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  return (
    <div className="note-file-block">
      <div className="note-file-icon">📄</div>
      <div className="note-file-info">
        <div className="note-file-name">{block.name}</div>
        <div className="note-file-sub">Lampiran file</div>
      </div>
      <div className="note-file-actions">
        <button className="btn-sm" onClick={download}>Unduh</button>
        <button className="btn-sm btn-danger" onMouseDown={e => { e.preventDefault(); onDelete() }}>Hapus</button>
      </div>
    </div>
  )
}

// ── Read-only blocks (admin view) ───────────────────────────
function BlocksReadOnly({ blocks }) {
  async function download(path) {
    const { data } = await supabase.storage.from('exercises').createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  return (
    <div className="blocks-readonly">
      {blocks.map(b => (
        <div key={b.id}>
          {b.type === 'text' ? (
            <div
              className="rich-editor-readonly"
              dangerouslySetInnerHTML={{
                __html: b.html || '<span style="opacity:.4;font-style:italic">— belum ada isi —</span>',
              }}
            />
          ) : (
            <div className="note-file-block readonly">
              <div className="note-file-icon">📄</div>
              <div className="note-file-info">
                <div className="note-file-name">{b.name}</div>
                <div className="note-file-sub">Lampiran file</div>
              </div>
              <button className="btn-sm" onClick={() => download(b.path)}>Unduh</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Collapsible student section (admin) ─────────────────────
function StudentSection({ student, blocks }) {
  const [open, setOpen] = useState(false)
  const hasContent = blocks && blocks.some(b => b.type === 'file' || b.html?.trim())
  return (
    <div className={`student-section${open ? ' open' : ''}`}>
      <div className="student-section-header" onClick={() => setOpen(x => !x)}>
        <div>
          <div className="student-section-name">{student.name}</div>
          <div className="student-section-meta">{student.npm} · {student.class}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!hasContent && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Belum ada catatan</span>}
          <span className="student-section-chevron">›</span>
        </div>
      </div>
      {open && (
        <div className="student-section-body">
          {blocks && blocks.length > 0
            ? <BlocksReadOnly blocks={blocks} />
            : <div className="student-section-empty">Belum ada catatan untuk sesi ini.</div>
          }
        </div>
      )}
    </div>
  )
}

// ── Student editable view ───────────────────────────────────
function StudentNotesView({ sectionId, userId }) {
  const [blocks, setBlocks]   = useState([newTextBlock()])
  const [status, setStatus]   = useState('')   // '' | 'saving' | 'saved' | 'error'
  const [loading, setLoading] = useState(true)
  const [loadKey, setLoadKey] = useState(0)
  const fileRef    = useRef()
  const blocksRef  = useRef(blocks)
  blocksRef.current = blocks

  useEffect(() => {
    setLoading(true)
    setStatus('')
    supabase
      .from('notes')
      .select('content')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .maybeSingle()
      .then(({ data }) => {
        const parsed = parseBlocks(data?.content ?? null)
        setBlocks(parsed)
        setLoadKey(k => k + 1)
        setLoading(false)
      })
  }, [sectionId, userId])

  async function saveNotes() {
    setStatus('saving')
    const { error } = await supabase
      .from('notes')
      .upsert(
        { user_id: userId, section_id: sectionId, content: JSON.stringify(blocksRef.current), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,section_id' }
      )
    if (error) {
      console.error('Save error:', error)
      setStatus('error')
      return
    }
    setStatus('saved')
    setTimeout(() => setStatus(''), 3000)
  }

  function mutateBlocks(fn) {
    const next = fn(blocksRef.current)
    const safe = next.length > 0 ? next : [newTextBlock()]
    setBlocks(safe)
  }

  function updateBlock(id, updated) {
    mutateBlocks(prev => prev.map(b => b.id === id ? updated : b))
  }

  function deleteBlock(id) {
    mutateBlocks(prev => prev.filter(b => b.id !== id))
  }

  function addTextBlock() {
    mutateBlocks(prev => [...prev, newTextBlock()])
  }

  async function uploadFile(file) {
    const path = `${userId}/notes/${sectionId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('exercises').upload(path, file)
    if (error) { alert(error.message); return }
    mutateBlocks(prev => [...prev, { id: genId(), type: 'file', name: file.name, path }])
  }

  if (loading) return <div className="empty-state"><p>Memuat catatan…</p></div>

  return (
    <div className="notes-blocks-container">
      <div className="notes-save-bar">
        <span>Catatan Anda untuk sesi ini</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'saved'  && <span className="save-saved">✓ Tersimpan</span>}
          {status === 'error'  && <span style={{ color: '#f87171', fontSize: 12 }}>✕ Gagal menyimpan</span>}
          <button
            className="btn btn-primary"
            style={{ padding: '5px 18px', fontSize: 13 }}
            onClick={saveNotes}
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Menyimpan…' : 'Simpan'}
          </button>
        </span>
      </div>

      <div className="blocks-list">
        {blocks.map(block =>
          block.type === 'text' ? (
            <RichBlock
              key={`${sectionId}-${block.id}-${loadKey}`}
              block={block}
              loadKey={loadKey}
              onChange={updated => updateBlock(block.id, updated)}
              onDelete={() => deleteBlock(block.id)}
            />
          ) : (
            <FileBlock
              key={`${sectionId}-${block.id}`}
              block={block}
              onDelete={() => deleteBlock(block.id)}
            />
          )
        )}
      </div>

      <div className="add-block-bar">
        <button className="add-block-btn" onClick={addTextBlock}>＋ Tambah area teks</button>
        <button className="add-block-btn" onClick={() => fileRef.current?.click()}>＋ Unggah file</button>
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = '' }}
        />
      </div>
    </div>
  )
}

// ── Admin view ──────────────────────────────────────────────
function AdminNotesView({ sectionId, selectedStudentId, students }) {
  const [notesByUser, setNotesByUser] = useState({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = supabase.from('notes').select('user_id, content').eq('section_id', sectionId)
    if (selectedStudentId) q.eq('user_id', selectedStudentId)
    q.then(({ data }) => {
      const map = {}
      for (const row of data ?? []) map[row.user_id] = parseBlocks(row.content)
      setNotesByUser(map)
      setLoading(false)
    })
  }, [sectionId, selectedStudentId])

  const displayStudents = selectedStudentId
    ? students.filter(s => s.id === selectedStudentId)
    : students

  if (loading) return <div className="empty-state"><p>Memuat…</p></div>

  return (
    <div className="admin-content-list">
      {displayStudents.map(s => (
        <StudentSection
          key={s.id}
          student={s}
          blocks={notesByUser[s.id] ?? null}
        />
      ))}
      {displayStudents.length === 0 && (
        <div className="empty-state"><p>Tidak ada mahasiswa yang sesuai filter.</p></div>
      )}
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────
export default function NotesTab({ sectionId, userId, profile, selectedStudentId, students }) {
  if (profile.is_admin) {
    return <AdminNotesView sectionId={sectionId} selectedStudentId={selectedStudentId} students={students} />
  }
  return <StudentNotesView sectionId={sectionId} userId={userId} />
}
