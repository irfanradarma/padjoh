import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function ExerciseTab({ sectionId, userId }) {
  const [files, setFiles]         = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragover, setDragover]   = useState(false)
  const inputRef = useRef()

  useEffect(() => { loadFiles() }, [sectionId, userId])

  async function loadFiles() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .order('uploaded_at', { ascending: false })
    setFiles(data ?? [])
  }

  async function uploadFile(file) {
    setUploading(true)
    const path = `${userId}/${sectionId}/${Date.now()}_${file.name}`
    const { error: storageErr } = await supabase.storage.from('exercises').upload(path, file)
    if (storageErr) { alert(storageErr.message); setUploading(false); return }
    await supabase.from('exercises').insert({
      user_id: userId, section_id: sectionId,
      file_name: file.name, file_path: path,
    })
    await loadFiles()
    setUploading(false)
  }

  async function deleteFile(f) {
    if (!confirm(`Hapus file "${f.file_name}"?`)) return
    await Promise.all([
      supabase.storage.from('exercises').remove([f.file_path]),
      supabase.from('exercises').delete().eq('id', f.id),
    ])
    setFiles(prev => prev.filter(x => x.id !== f.id))
  }

  async function downloadFile(f) {
    const { data } = await supabase.storage
      .from('exercises')
      .createSignedUrl(f.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function onDrop(e) {
    e.preventDefault()
    setDragover(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function fmtDate(str) {
    return new Date(str).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <div
        className={`upload-zone${dragover ? ' dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current.click()}
      >
        <div className="upload-icon">{uploading ? '⏳' : '📁'}</div>
        <div className="upload-text">{uploading ? 'Mengunggah…' : 'Klik atau seret file ke sini'}</div>
        <div className="upload-hint">Semua jenis file diterima</div>
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = '' }}
        />
      </div>

      {files.length === 0 && !uploading ? (
        <div className="empty-state" style={{ paddingTop: 28 }}>
          <p>Belum ada file yang diunggah untuk sesi ini.</p>
        </div>
      ) : (
        <div className="file-list">
          {files.map(f => (
            <div key={f.id} className="file-item">
              <div className="file-icon">📄</div>
              <div className="file-info">
                <div className="file-name">{f.file_name}</div>
                <div className="file-meta">{fmtDate(f.uploaded_at)}</div>
              </div>
              <div className="file-actions">
                <button className="btn-sm" onClick={() => downloadFile(f)}>Unduh</button>
                <button className="btn-sm btn-danger" onClick={() => deleteFile(f)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
