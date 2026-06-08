import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function NotesTab({ sectionId, userId }) {
  const [content, setContent] = useState('')
  const [status, setStatus]   = useState('') // '' | 'saving' | 'saved'
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('notes')
      .select('content')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .maybeSingle()
      .then(({ data }) => {
        setContent(data?.content ?? '')
        setLoading(false)
      })
  }, [sectionId, userId])

  async function save(value) {
    setStatus('saving')
    await supabase
      .from('notes')
      .upsert(
        { user_id: userId, section_id: sectionId, content: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,section_id' }
      )
    setStatus('saved')
    setTimeout(() => setStatus(''), 2500)
  }

  function handleChange(e) {
    const value = e.target.value
    setContent(value)
    setStatus('')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 1000)
  }

  if (loading) return <div className="empty-state"><p>Memuat catatan…</p></div>

  return (
    <div className="notes-editor">
      <div className="notes-toolbar">
        <span>Catatan Anda untuk sesi ini</span>
        <span>
          {status === 'saving' && <span className="save-saving">● Menyimpan…</span>}
          {status === 'saved'  && <span className="save-saved">✓ Tersimpan</span>}
        </span>
      </div>
      <textarea
        className="notes-textarea"
        value={content}
        onChange={handleChange}
        placeholder="Mulai menulis catatan Anda di sini… Anda bisa menempel teks, menulis ringkasan, atau mencatat konsep penting."
      />
    </div>
  )
}
