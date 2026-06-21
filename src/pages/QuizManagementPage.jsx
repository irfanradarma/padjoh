import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { SECTIONS } from '../sections'

// ── helpers ───────────────────────────────────────────────────
const BLANK_QUIZ = {
  title: '', time_limit: 30, password: '',
  shuffle: false, speed_weight: 50, accuracy_weight: 50,
  reveal_mode: 'immediate', reveal_delay: 0, tournament: false,
}
const BLANK_OPTION = (order_num) => ({ order_num, option_text: '', is_correct: false, _key: Math.random() })
const BLANK_QUESTION = (order_num) => ({
  order_num, question_type: 'text', question_text: '', question_url: '',
  options: [1,2,3,4].map(BLANK_OPTION),
  _key: Math.random(),
})

// ── Rubric / weight helper ────────────────────────────────────
function WeightSlider({ speedWeight, onChange }) {
  return (
    <div className="qm-weight-row">
      <div className="qm-weight-labels">
        <span>Kecepatan <strong>{speedWeight}%</strong></span>
        <span>Akurasi <strong>{100 - speedWeight}%</strong></span>
      </div>
      <input
        type="range" min={0} max={100} value={speedWeight}
        onChange={e => onChange(Number(e.target.value))}
        className="qm-weight-slider"
      />
    </div>
  )
}

// ── Question editor ───────────────────────────────────────────
function QuestionCard({ q, idx, total, onChange, onDelete, onMove }) {
  const setCorrect = (oi) => onChange({
    ...q,
    options: q.options.map((o, i) => ({ ...o, is_correct: i === oi })),
  })

  return (
    <div className="qm-qcard">
      <div className="qm-qcard-head">
        <span className="qm-qnum">#{idx + 1}</span>
        <select
          className="qm-qtype-sel"
          value={q.question_type}
          onChange={e => onChange({ ...q, question_type: e.target.value })}
        >
          <option value="text">Teks</option>
          <option value="image">Gambar (URL)</option>
          <option value="video">Video (URL)</option>
        </select>
        <div className="qm-qcard-actions">
          <button className="btn-icon" disabled={idx === 0} onClick={() => onMove(idx, -1)}>↑</button>
          <button className="btn-icon" disabled={idx === total - 1} onClick={() => onMove(idx, 1)}>↓</button>
          <button className="btn-icon btn-danger-icon" onClick={onDelete}>✕</button>
        </div>
      </div>

      <textarea
        className="qm-qtext"
        placeholder="Teks pertanyaan"
        value={q.question_text ?? ''}
        rows={2}
        onChange={e => onChange({ ...q, question_text: e.target.value })}
      />

      {(q.question_type === 'image' || q.question_type === 'video') && (
        <input
          className="input"
          placeholder={q.question_type === 'image' ? 'URL gambar' : 'URL video (YouTube embed, dsb.)'}
          value={q.question_url ?? ''}
          onChange={e => onChange({ ...q, question_url: e.target.value })}
          style={{ marginBottom: 8 }}
        />
      )}

      {q.question_type === 'image' && q.question_url && (
        <img src={q.question_url} alt="preview" className="qm-qimg-preview" />
      )}
      {q.question_type === 'video' && q.question_url && (
        <iframe src={q.question_url} className="qm-qvid-preview" allowFullScreen title="video" />
      )}

      <div className="qm-options">
        {q.options.map((o, oi) => (
          <div key={o._key ?? oi} className="qm-opt-row">
            <input
              type="radio"
              name={`correct-${q._key}`}
              checked={o.is_correct}
              onChange={() => setCorrect(oi)}
              className="qm-opt-radio"
              title="Tandai sebagai jawaban benar"
            />
            <span className="qm-opt-label">{String.fromCharCode(65 + oi)}.</span>
            <input
              className="qm-opt-input"
              placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`}
              value={o.option_text}
              onChange={e => onChange({
                ...q,
                options: q.options.map((x, i) => i === oi ? { ...x, option_text: e.target.value } : x),
              })}
            />
            {q.options.length > 2 && (
              <button
                className="btn-icon btn-danger-icon"
                onClick={() => onChange({ ...q, options: q.options.filter((_, i) => i !== oi).map((x, i) => ({ ...x, order_num: i + 1 })) })}
              >✕</button>
            )}
          </div>
        ))}
        {q.options.length < 6 && (
          <button
            className="qm-add-opt-btn"
            onClick={() => onChange({ ...q, options: [...q.options, BLANK_OPTION(q.options.length + 1)] })}
          >+ Tambah Pilihan</button>
        )}
      </div>
    </div>
  )
}

// ── General settings tab ──────────────────────────────────────
function GeneralTab({ form, setForm }) {
  return (
    <div className="qm-gen-form">
      <label className="qm-label">
        Judul Kuis
        <input className="input" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Contoh: Kuis UTS IS Audit" />
      </label>

      <label className="qm-label">
        Batas Waktu (menit)
        <input className="input" type="number" min={1} max={180} value={form.time_limit}
          onChange={e => setForm(f => ({ ...f, time_limit: Number(e.target.value) }))} />
      </label>

      <label className="qm-label">
        Password Check-in <span className="qm-optional">(kosongkan jika tanpa password)</span>
        <input className="input" value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="Password check-in" />
      </label>

      <div className="qm-label">
        Bobot Skor
        <WeightSlider
          speedWeight={form.speed_weight}
          onChange={v => setForm(f => ({ ...f, speed_weight: v, accuracy_weight: 100 - v }))}
        />
      </div>

      <label className="qm-label">
        Tampilkan Kunci Jawaban
        <select className="input" value={form.reveal_mode}
          onChange={e => setForm(f => ({ ...f, reveal_mode: e.target.value }))}>
          <option value="immediate">Langsung setelah selesai</option>
          <option value="delayed">Setelah X menit</option>
          <option value="never">Jangan ditampilkan</option>
        </select>
      </label>

      {form.reveal_mode === 'delayed' && (
        <label className="qm-label">
          Delay (menit)
          <input className="input" type="number" min={1} value={form.reveal_delay}
            onChange={e => setForm(f => ({ ...f, reveal_delay: Number(e.target.value) }))} />
        </label>
      )}

      <div className="qm-checkbox-row">
        <label className="qm-checkbox-label">
          <input type="checkbox" checked={form.shuffle}
            onChange={e => setForm(f => ({ ...f, shuffle: e.target.checked }))} />
          Acak urutan pertanyaan
        </label>
        <label className="qm-checkbox-label">
          <input type="checkbox" checked={form.tournament}
            onChange={e => setForm(f => ({ ...f, tournament: e.target.checked }))} />
          Setup turnamen (pairing berdasarkan skor)
        </label>
      </div>
    </div>
  )
}

// ── Questions tab ─────────────────────────────────────────────
function QuestionsTab({ questions, setQuestions }) {
  function addQuestion() {
    setQuestions(qs => [...qs, BLANK_QUESTION(qs.length + 1)])
  }

  function updateQ(idx, q) {
    setQuestions(qs => qs.map((x, i) => i === idx ? q : x))
  }

  function deleteQ(idx) {
    setQuestions(qs =>
      qs.filter((_, i) => i !== idx).map((x, i) => ({ ...x, order_num: i + 1 }))
    )
  }

  function moveQ(idx, dir) {
    const next = [...questions]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setQuestions(next.map((q, i) => ({ ...q, order_num: i + 1 })))
  }

  return (
    <div className="qm-questions-tab">
      {questions.length === 0 && (
        <div className="empty-state"><p>Belum ada pertanyaan. Klik tombol di bawah untuk menambah.</p></div>
      )}
      {questions.map((q, idx) => (
        <QuestionCard
          key={q._key ?? idx}
          q={q} idx={idx} total={questions.length}
          onChange={q2 => updateQ(idx, q2)}
          onDelete={() => deleteQ(idx)}
          onMove={(i, dir) => moveQ(i, dir)}
        />
      ))}
      <button className="qm-add-q-btn" onClick={addQuestion}>+ Tambah Pertanyaan</button>
    </div>
  )
}

// ── Deploy tab ────────────────────────────────────────────────
function DeployTab({ quizId, onDeploy }) {
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(null)

  async function load() {
    const results = await Promise.all(
      SECTIONS.map(s => supabase.rpc('get_section_quiz_deployments', { p_section_id: s.id }))
    )
    const dep = []
    results.forEach(({ data }, i) => {
      const found = (data ?? []).find(d => d.quiz_id === quizId)
      if (found) dep.push({ ...found, section: SECTIONS[i] })
    })
    setDeployments(dep)
    setLoading(false)
  }

  useEffect(() => { load() }, [quizId])

  async function deploy(sectionId) {
    setBusy(sectionId)
    const { error } = await supabase.rpc('admin_deploy_quiz', { p_quiz_id: quizId, p_section_id: sectionId })
    if (error) alert(error.message)
    await load()
    setBusy(null)
    onDeploy?.()
  }

  async function undeploy(deploymentId) {
    if (!confirm('Hapus deployment ini? Sesi yang sudah ada akan ikut terhapus.')) return
    const { error } = await supabase.rpc('admin_undeploy_quiz', { p_deployment_id: deploymentId })
    if (error) alert(error.message)
    await load()
    onDeploy?.()
  }

  if (loading) return <div className="empty-state"><p>Memuat…</p></div>

  const deployedIds = new Set(deployments.map(d => d.section?.id))

  return (
    <div className="qm-deploy-tab">
      <div className="qm-deploy-title">Deploy ke Sesi Kelas</div>
      <div className="qm-section-grid">
        {SECTIONS.map(s => {
          const dep = deployments.find(d => d.section?.id === s.id)
          return (
            <div key={s.id} className={`qm-section-card${dep ? ' deployed' : ''}`}>
              <div className="qm-section-info">
                <div className="qm-section-num">{s.id}</div>
                <div className="qm-section-title">{s.short}</div>
              </div>
              {dep ? (
                <button className="btn-sm btn-danger" onClick={() => undeploy(dep.deployment_id)}>
                  Hapus
                </button>
              ) : (
                <button className="btn-sm btn-primary" onClick={() => deploy(s.id)} disabled={busy === s.id}>
                  {busy === s.id ? '…' : 'Deploy'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Quiz editor (create / edit) ───────────────────────────────
function QuizEditor({ quizId, onBack, onSaved }) {
  const [activeTab, setActiveTab] = useState('general')
  const [form, setForm]           = useState(BLANK_QUIZ)
  const [questions, setQuestions] = useState([])
  const [saving, setSaving]       = useState(false)
  const [savedId, setSavedId]     = useState(quizId)
  const [savErr, setSavErr]       = useState('')

  useEffect(() => {
    if (!quizId) return
    supabase.rpc('admin_get_quiz', { p_quiz_id: quizId }).then(({ data }) => {
      if (!data) return
      setForm({
        title:           data.title,
        time_limit:      Math.round(data.time_limit / 60),
        password:        data.password ?? '',
        shuffle:         data.shuffle,
        speed_weight:    data.speed_weight,
        accuracy_weight: data.accuracy_weight,
        reveal_mode:     data.reveal_mode,
        reveal_delay:    data.reveal_delay,
        tournament:      data.tournament,
      })
      setQuestions(
        (data.questions ?? []).map(q => ({
          ...q,
          _key: Math.random(),
          options: (q.options ?? []).map(o => ({ ...o, _key: Math.random() })),
        }))
      )
      setSavedId(quizId)
    })
  }, [quizId])

  async function save() {
    if (!form.title.trim()) { setSavErr('Judul kuis wajib diisi.'); return }
    setSaving(true); setSavErr('')
    const { data: newId, error } = await supabase.rpc('admin_upsert_quiz', {
      p_id:              savedId ?? null,
      p_title:           form.title.trim(),
      p_time_limit:      form.time_limit * 60,
      p_password:        form.password || null,
      p_shuffle:         form.shuffle,
      p_speed_weight:    form.speed_weight,
      p_accuracy_weight: form.accuracy_weight,
      p_reveal_mode:     form.reveal_mode,
      p_reveal_delay:    form.reveal_delay,
      p_tournament:      form.tournament,
    })
    if (error) { setSavErr(error.message); setSaving(false); return }

    if (!savedId) setSavedId(newId)

    const cleanQ = questions.map((q, i) => ({
      order_num:     i + 1,
      question_type: q.question_type,
      question_text: q.question_text || null,
      question_url:  q.question_url  || null,
      options: q.options.map((o, j) => ({
        order_num:   j + 1,
        option_text: o.option_text,
        is_correct:  o.is_correct,
      })),
    }))
    const { error: qErr } = await supabase.rpc('admin_save_quiz_questions', {
      p_quiz_id: newId ?? savedId, p_questions: cleanQ,
    })
    if (qErr) { setSavErr(qErr.message); setSaving(false); return }

    setSaving(false)
    onSaved?.()
  }

  return (
    <div className="qm-editor">
      <div className="qm-editor-topbar">
        <button className="btn-sm" onClick={onBack}>← Kembali</button>
        <h2 className="qm-editor-title">{savedId ? 'Edit Kuis' : 'Buat Kuis Baru'}</h2>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan…' : '💾 Simpan'}
        </button>
      </div>
      {savErr && <div className="qm-err">{savErr}</div>}

      <div className="tabs" style={{ marginBottom: 0 }}>
        {[['general','⚙️ Pengaturan'], ['questions','❓ Pertanyaan'], savedId && ['deploy','🚀 Deploy']].filter(Boolean).map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >{label}</button>
        ))}
      </div>

      <div className="qm-editor-body">
        {activeTab === 'general'   && <GeneralTab form={form} setForm={setForm} />}
        {activeTab === 'questions' && <QuestionsTab questions={questions} setQuestions={setQuestions} />}
        {activeTab === 'deploy'    && savedId && <DeployTab quizId={savedId} onDeploy={() => {}} />}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function QuizManagementPage() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null | { id } | { id: undefined } for new

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('admin_list_quizzes')
    setQuizzes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteQuiz(id, title) {
    if (!confirm(`Hapus kuis "${title}"? Tindakan ini tidak bisa dibatalkan.`)) return
    await supabase.rpc('admin_delete_quiz', { p_quiz_id: id })
    load()
  }

  if (editing !== null) {
    return (
      <div className="page-content">
        <QuizEditor
          quizId={editing.id}
          onBack={() => { setEditing(null); load() }}
          onSaved={load}
        />
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Manajemen Kuis</h2>
        <button className="btn btn-primary" onClick={() => setEditing({ id: undefined })}>+ Buat Kuis Baru</button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Memuat kuis…</p></div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada kuis. Buat kuis pertama Anda!</p>
        </div>
      ) : (
        <div className="qm-quiz-list">
          {quizzes.map(q => (
            <div key={q.id} className="qm-quiz-card">
              <div className="qm-quiz-info">
                <div className="qm-quiz-title">{q.title}</div>
                <div className="qm-quiz-meta">
                  {q.question_count} pertanyaan
                  · {Math.round(q.time_limit / 60)} mnt
                  · {q.tournament ? '🏆 Turnamen' : 'Reguler'}
                  · {q.deployment_count} sesi di-deploy
                </div>
              </div>
              <div className="qm-quiz-actions">
                <button className="btn-sm btn-primary" onClick={() => setEditing({ id: q.id })}>✏️ Edit</button>
                <button className="btn-sm btn-danger" onClick={() => deleteQuiz(q.id, q.title)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
