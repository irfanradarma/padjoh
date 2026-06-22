import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabaseClient'

// ── Tournament pairing ────────────────────────────────────────
function computePairs(results) {
  const n = results.length
  if (n === 0) return []
  if (n === 1) return [[results[0]]]
  if (n % 2 === 0) {
    return Array.from({ length: n / 2 }, (_, i) => [results[i], results[n - 1 - i]])
  }
  const mid = Math.floor(n / 2)
  const pairs = []
  for (let i = 0; i < mid - 1; i++) pairs.push([results[i], results[n - 1 - i]])
  pairs.push([results[mid - 1], results[mid], results[mid + 1]])
  return pairs
}

function fmtTime(sec) {
  if (sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function useCountdown(startedAt, timeLimitSec) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    if (!startedAt) { setRemaining(null); return }
    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      setRemaining(Math.max(0, timeLimitSec - elapsed))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startedAt, timeLimitSec])
  return remaining
}

// ── Admin: checkin monitor ────────────────────────────────────
function AdminCheckinView({ monitor, sessionId, onRefresh, onMonitorUpdate }) {
  const { session, quiz, checkins, results } = monitor
  const [starting, setStarting] = useState(false)
  const [ending, setEnding]     = useState(false)
  const checkedIn = checkins.filter(c => c.checked_in).length
  const remaining = useCountdown(session.started_at, quiz.time_limit)

  async function startQuiz() {
    setStarting(true)
    const { error } = await supabase.rpc('admin_start_quiz', { p_session_id: sessionId })
    if (error) { alert(error.message); setStarting(false); return }
    await onMonitorUpdate()
    setStarting(false)
  }

  async function endQuiz() {
    if (!confirm('Akhiri kuis sekarang? Jawaban tidak dapat diubah lagi.')) return
    setEnding(true)
    const { error } = await supabase.rpc('admin_end_quiz', { p_session_id: sessionId })
    if (error) { alert(error.message); setEnding(false); return }
    await onMonitorUpdate()
    setEnding(false)
  }

  return (
    <div className="qv-admin-wrap">
      <div className="qv-admin-header">
        <div className="qv-admin-quiz-title">{quiz.title}</div>
        <div className="qv-admin-class">Kelas {session.class}</div>
        {session.status === 'checkin' && (
          <div className="qv-admin-status qv-status-checkin">
            ⏳ Check-in — {checkedIn}/{checkins.length} mahasiswa
          </div>
        )}
        {session.status === 'active' && (
          <div className="qv-admin-status qv-status-active">
            🔴 Berlangsung — Sisa {fmtTime(remaining ?? quiz.time_limit)}
          </div>
        )}
        {session.status === 'finished' && (
          <div className="qv-admin-status qv-status-done">✅ Selesai</div>
        )}
      </div>

      {session.status === 'checkin' && (
        <>
          <div className="qv-checkin-list">
            {checkins.map(c => (
              <div key={c.user_id} className={`qv-checkin-row${c.checked_in ? ' checked' : ''}`}>
                <span className="qv-checkin-dot">{c.checked_in ? '✅' : '⬜'}</span>
                <span className="qv-checkin-name">{c.name}</span>
                <span className="qv-checkin-npm">{c.npm}</span>
              </div>
            ))}
            {checkins.length === 0 && (
              <div className="empty-state"><p>Belum ada mahasiswa di kelas ini.</p></div>
            )}
          </div>
          <div className="qv-admin-actions">
            <button className="btn" onClick={onRefresh}>🔄 Refresh</button>
            <button className="btn btn-primary" onClick={startQuiz} disabled={starting || checkedIn === 0}>
              {starting ? 'Memulai…' : `▶ Mulai (${checkedIn} peserta)`}
            </button>
          </div>
        </>
      )}

      {session.status === 'active' && (
        <>
          <div className="qv-active-info">
            <div className="qv-active-stat">
              <div className="qv-active-val">{checkedIn}</div>
              <div className="qv-active-lbl">Peserta</div>
            </div>
            <div className="qv-active-stat">
              <div className="qv-active-val qv-timer-big">{fmtTime(remaining ?? 0)}</div>
              <div className="qv-active-lbl">Sisa Waktu</div>
            </div>
          </div>
          <div className="qv-admin-actions">
            <button className="btn btn-danger" onClick={endQuiz} disabled={ending}>
              {ending ? 'Mengakhiri…' : '⏹ Akhiri Kuis'}
            </button>
          </div>
        </>
      )}

      {session.status === 'finished' && <AdminResultsView results={results} quiz={quiz} />}
    </div>
  )
}

function AdminResultsView({ results, quiz }) {
  const pairs = quiz.tournament ? computePairs(results) : []
  return (
    <div className="qv-results-wrap">
      <h3 className="qv-results-title">Hasil Kuis</h3>
      <table className="qv-results-table">
        <thead>
          <tr><th>Rank</th><th>Nama</th><th>NPM</th><th>Akurasi</th><th>Kecepatan</th><th>Total</th></tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.user_id}>
              <td className="qv-rank">#{r.rank}</td>
              <td>{r.name}</td>
              <td className="qv-npm">{r.npm}</td>
              <td>{Number(r.accuracy).toFixed(1)}%</td>
              <td>{Number(r.speed).toFixed(1)}%</td>
              <td className="qv-total"><strong>{Number(r.total).toFixed(1)}</strong></td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr><td colSpan={6} className="qv-empty-cell">Tidak ada hasil.</td></tr>
          )}
        </tbody>
      </table>
      {quiz.tournament && pairs.length > 0 && (
        <div className="qv-pairs-section">
          <h3 className="qv-results-title" style={{ marginTop: 24 }}>Pasangan Turnamen</h3>
          <div className="qv-pairs-grid">
            {pairs.map((group, i) => (
              <div key={i} className="qv-pair-card">
                <div className="qv-pair-num">Grup {i + 1}</div>
                {group.map(p => (
                  <div key={p.user_id} className="qv-pair-member">
                    <span className="qv-pair-rank">#{p.rank}</span>
                    <span>{p.name}</span>
                    <span className="qv-pair-score">{Number(p.total).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Student: check-in gate ────────────────────────────────────
function CheckinGate({ sessionId, quizTitle, hasPassword, onCheckedIn }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.rpc('quiz_checkin', {
      p_session_id: sessionId, p_password: password || null,
    })
    if (error) { setError(error.message); setLoading(false); return }
    onCheckedIn()
  }

  return (
    <div className="qv-gate">
      <div className="qv-gate-icon">📝</div>
      <h2 className="qv-gate-title">{quizTitle}</h2>
      <p className="qv-gate-sub">
        {hasPassword ? 'Masukkan password untuk check-in.' : 'Klik tombol untuk check-in ke kuis.'}
      </p>
      <form onSubmit={submit} className="qv-gate-form">
        {hasPassword && (
          <input className="input" type="password" placeholder="Password check-in"
            value={password} onChange={e => setPassword(e.target.value)} autoFocus />
        )}
        {error && <div className="qm-err">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Memproses…' : 'Check-in'}
        </button>
      </form>
    </div>
  )
}

function StudentLobby({ quizTitle }) {
  return (
    <div className="qv-lobby">
      <div className="qv-lobby-icon">⏳</div>
      <h2 className="qv-lobby-title">{quizTitle}</h2>
      <p className="qv-lobby-msg">Anda sudah check-in. Menunggu admin memulai kuis…</p>
    </div>
  )
}

// ── Student: questions + submit ───────────────────────────────
function StudentQuizView({ sessionId, questions, startedAt, timeLimitSec }) {
  const [answers, setAnswers]       = useState({})
  const [savingQ, setSavingQ]       = useState({})   // per-question saving indicator
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitFired             = useRef(false)
  const remaining = useCountdown(startedAt, timeLimitSec)
  const timeUp    = remaining !== null && remaining <= 0
  const locked    = submitted || timeUp

  // Pre-fill previously saved answers
  useEffect(() => {
    const initial = {}
    for (const q of questions) if (q.my_answer) initial[q.id] = q.my_answer
    setAnswers(initial)
  }, [questions])

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (!timeUp || autoSubmitFired.current || submitted) return
    autoSubmitFired.current = true
    supabase.rpc('quiz_submit', { p_session_id: sessionId }).then(() => setSubmitted(true))
  }, [timeUp, submitted, sessionId])

  async function pickAnswer(questionId, optionId) {
    if (locked) return
    setAnswers(prev => ({ ...prev, [questionId]: optionId }))
    setSavingQ(prev => ({ ...prev, [questionId]: true }))
    await supabase.rpc('quiz_submit_answer', {
      p_session_id: sessionId, p_question_id: questionId, p_option_id: optionId,
    })
    setSavingQ(prev => ({ ...prev, [questionId]: false }))
  }

  async function handleSubmit() {
    if (locked || submitting) return
    const answered = Object.keys(answers).length
    const total    = questions.length
    const unanswered = total - answered
    const msg = unanswered > 0
      ? `Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin mengumpulkan sekarang?`
      : 'Yakin ingin mengumpulkan jawaban? Jawaban tidak dapat diubah setelah dikumpulkan.'
    if (!confirm(msg)) return
    setSubmitting(true)
    await supabase.rpc('quiz_submit', { p_session_id: sessionId })
    setSubmitted(true)
    setSubmitting(false)
  }

  const answered = Object.keys(answers).length
  const total    = questions.length

  return (
    <div className="qv-student-quiz">
      {/* Sticky top bar */}
      <div className={`qv-quiz-topbar${timeUp ? ' time-up' : submitted ? ' submitted' : ''}`}>
        <span className="qv-quiz-progress">
          {answered}/{total} dijawab
        </span>
        <span className={`qv-quiz-timer${remaining !== null && remaining < 60 && !timeUp ? ' urgent' : ''}`}>
          {timeUp ? '⏰ Waktu Habis' : `⏱ ${fmtTime(remaining ?? timeLimitSec)}`}
        </span>
        {!submitted && !timeUp && (
          <button
            className="btn btn-primary qv-topbar-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '…' : '✅ Kumpulkan'}
          </button>
        )}
        {submitted && <span className="qv-submitted-chip">✅ Dikumpulkan</span>}
      </div>

      {/* Status banners */}
      {submitted && !timeUp && (
        <div className="qv-submitted-banner">
          ✅ Jawaban berhasil dikumpulkan! Menunggu admin menutup kuis…
        </div>
      )}
      {timeUp && (
        <div className="qv-time-up-banner">
          ⏰ Waktu habis — jawaban otomatis dikumpulkan. Menunggu admin menutup kuis…
        </div>
      )}

      {/* Questions (read-only when locked) */}
      <div className="qv-questions-list">
        {questions.map((q, qi) => (
          <div key={q.id} className={`qv-question-card${locked ? ' locked' : ''}`}>
            <div className="qv-q-num">Soal {qi + 1}</div>
            {q.question_text && <div className="qv-q-text">{q.question_text}</div>}
            {q.question_type === 'image' && q.question_url && (
              <img src={q.question_url} alt="soal" className="qv-q-img" />
            )}
            {q.question_type === 'video' && q.question_url && (
              <iframe src={q.question_url} className="qv-q-video" allowFullScreen title={`soal ${qi + 1}`} />
            )}
            <div className="qv-options">
              {q.options.map((o, oi) => (
                <label
                  key={o.id}
                  className={`qv-option${answers[q.id] === o.id ? ' selected' : ''}${locked ? ' disabled' : ''}`}
                  onClick={() => pickAnswer(q.id, o.id)}
                >
                  <span className="qv-opt-lbl">{String.fromCharCode(65 + oi)}.</span>
                  <span className="qv-opt-text">{o.option_text}</span>
                  {savingQ[q.id] && answers[q.id] === o.id && (
                    <span className="qv-saving">…</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom submit — only when not locked */}
      {!locked && total > 0 && (
        <div className="qv-bottom-submit">
          <div className="qv-bottom-submit-info">
            {answered === total
              ? `Semua ${total} soal sudah dijawab`
              : `${answered} dari ${total} soal dijawab (${total - answered} belum)`}
          </div>
          <button
            className={`btn btn-primary${answered < total ? ' btn-warn-outline' : ''}`}
            onClick={handleSubmit}
            disabled={submitting}
            style={{ minWidth: 180 }}
          >
            {submitting ? 'Mengumpulkan…' : '✅ Kumpulkan Jawaban'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Student: recap ────────────────────────────────────────────
function StudentRecap({ resultData, isTournament }) {
  const { my_result, results = [], correct_options } = resultData ?? {}
  const pairs = isTournament ? computePairs(results) : []
  const myPairGroup = my_result
    ? pairs.find(g => g.some(m => m.rank === my_result.rank))
    : null

  // Calculate mean and median score of the class
  const totalScores = results
    .map(r => r.total !== undefined && r.total !== null ? Number(r.total) : null)
    .filter(val => val !== null && !isNaN(val))
  const count = totalScores.length
  const mean = count > 0 ? totalScores.reduce((sum, score) => sum + score, 0) / count : 0

  const sortedScores = [...totalScores].sort((a, b) => a - b)
  let median = 0
  if (count > 0) {
    const mid = Math.floor(count / 2)
    if (count % 2 !== 0) {
      median = sortedScores[mid]
    } else {
      median = (sortedScores[mid - 1] + sortedScores[mid]) / 2
    }
  }

  return (
    <div className="qv-recap">
      <div className="qv-recap-icon">🎉</div>
      <h2 className="qv-recap-title">Kuis Selesai!</h2>
      {my_result ? (
        <div className="qv-recap-scores">
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">{Number(my_result.total).toFixed(1)}</div>
            <div className="qv-recap-score-lbl">Total Skor</div>
          </div>
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">#{my_result.rank}</div>
            <div className="qv-recap-score-lbl">Peringkat</div>
          </div>
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">{Number(my_result.accuracy).toFixed(1)}%</div>
            <div className="qv-recap-score-lbl">Akurasi</div>
          </div>
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">{Number(my_result.speed).toFixed(1)}%</div>
            <div className="qv-recap-score-lbl">Kecepatan</div>
          </div>
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">{mean.toFixed(1)}</div>
            <div className="qv-recap-score-lbl">Rata-rata Kelas</div>
          </div>
          <div className="qv-recap-score-card">
            <div className="qv-recap-score-val">{median.toFixed(1)}</div>
            <div className="qv-recap-score-lbl">Median Kelas</div>
          </div>
        </div>
      ) : (
        <p className="qv-recap-no-result">Skor belum tersedia.</p>
      )}
      {isTournament && myPairGroup && (
        <div className="qv-recap-pair-section">
          <h3 className="qv-recap-pair-title">Pasangan Anda Selanjutnya</h3>
          <div className="qv-recap-pair-group">
            {myPairGroup.map(m => {
              const isMe = m.rank === my_result?.rank
              return (
                <div key={m.user_id} className={`qv-recap-pair-member${isMe ? ' me' : ''}`}>
                  {isMe && <span className="qv-pair-rank">#{m.rank}</span>}
                  <span>{m.name}</span>
                  {isMe && <span className="qv-pair-score">{Number(m.total).toFixed(1)}</span>}
                  {isMe && <span className="qv-me-badge">Anda</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {correct_options && (
        <div className="qv-reveal-note">✅ Kunci jawaban telah dirilis.</div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────
export default function QuizView({
  sessionId, quizTitle, hasPassword, profile, onBack,
  initialStatus = 'checkin',
  initialCheckedIn = false,
  startedAt: initStartedAt = null,
  timeLimitSec: initTimeLimitSec = 300,
  isTournament: initTournament = false,
}) {
  const isAdmin = profile.is_admin

  // --- Admin state ---
  const [monitor, setMonitor]   = useState(null)
  const [monLoading, setMonLoad] = useState(isAdmin)

  // --- Student state ---
  const [status, setStatus]           = useState(initialStatus)
  const [isCheckedIn, setCheckedIn]   = useState(initialCheckedIn)
  const [startedAt, setStartedAt]     = useState(initStartedAt)
  const [timeLimitSec, setTimeLimitSec] = useState(initTimeLimitSec)
  const [isTournament, setTournament] = useState(initTournament)
  const [questions, setQuestions]     = useState([])
  const [resultData, setResultData]   = useState(null)

  async function loadMonitor() {
    const { data } = await supabase.rpc('admin_get_session_monitor', { p_session_id: sessionId })
    if (data) {
      setMonitor(data)
      setStatus(data.session?.status)
    }
    setMonLoad(false)
  }

  async function loadQuestions() {
    const { data } = await supabase.rpc('get_quiz_questions', { p_session_id: sessionId })
    setQuestions(data ?? [])
  }

  async function loadResult() {
    const { data } = await supabase.rpc('get_quiz_results', { p_session_id: sessionId })
    setResultData(data)
  }

  useEffect(() => {
    if (!sessionId) return

    if (isAdmin) {
      loadMonitor()
    } else {
      // Student: load questions if already active; load results if finished
      if (initialStatus === 'active') loadQuestions()
      if (initialStatus === 'finished') loadResult()
    }

    // Realtime subscription
    const channel = supabase
      .channel(`qv-${sessionId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const ns = payload.new?.status
          if (!ns) return
          setStatus(ns)
          if (isAdmin) {
            loadMonitor()
          } else {
            if (ns === 'active') {
              if (payload.new?.started_at) setStartedAt(payload.new.started_at)
              loadQuestions()
            }
            if (ns === 'finished') loadResult()
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId])

  // Polling fallback: realtime may be blocked by RLS until the policy patch is applied.
  // Poll every 3 s while student is in the lobby (checked-in, status still 'checkin').
  useEffect(() => {
    if (isAdmin || !isCheckedIn || status !== 'checkin' || !sessionId) return
    const id = setInterval(async () => {
      const { data } = await supabase.rpc('get_quiz_session_info', { p_session_id: sessionId })
      if (!data) return
      if (data.status === 'active') {
        setStatus('active')
        if (data.started_at) setStartedAt(data.started_at)
        loadQuestions()
      } else if (data.status === 'finished') {
        setStatus('finished')
        loadResult()
      }
    }, 3000)
    return () => clearInterval(id)
  }, [isAdmin, isCheckedIn, status, sessionId])

  if (!sessionId) {
    return (
      <div className="qv-wrap">
        <button className="btn-sm qv-back-btn" onClick={onBack}>← Kembali</button>
        <div className="qv-lobby">
          <div className="qv-lobby-icon">🔒</div>
          <h2 className="qv-lobby-title">{quizTitle}</h2>
          <p className="qv-lobby-msg">Kuis belum dibuka oleh admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="qv-wrap">
      <button className="btn-sm qv-back-btn" onClick={onBack}>← Kembali</button>

      {isAdmin ? (
        monLoading
          ? <div className="empty-state"><p>Memuat…</p></div>
          : monitor
            ? <AdminCheckinView
                monitor={monitor}
                sessionId={sessionId}
                onRefresh={loadMonitor}
                onMonitorUpdate={loadMonitor}
              />
            : <div className="empty-state"><p>Sesi tidak ditemukan.</p></div>
      ) : (
        <>
          {/* Not checked in + check-in open */}
          {!isCheckedIn && status === 'checkin' && (
            <CheckinGate
              sessionId={sessionId}
              quizTitle={quizTitle}
              hasPassword={hasPassword}
              onCheckedIn={() => setCheckedIn(true)}
            />
          )}
          {/* Checked in, waiting for start */}
          {isCheckedIn && status === 'checkin' && <StudentLobby quizTitle={quizTitle} />}
          {/* Quiz active */}
          {status === 'active' && isCheckedIn && !resultData && (
            <StudentQuizView
              sessionId={sessionId}
              questions={questions}
              startedAt={startedAt}
              timeLimitSec={timeLimitSec}
            />
          )}
          {/* Session closed but student was time-up and waiting */}
          {status === 'active' && !isCheckedIn && (
            <div className="qv-lobby">
              <div className="qv-lobby-icon">⚠️</div>
              <h2 className="qv-lobby-title">Kuis sudah dimulai</h2>
              <p className="qv-lobby-msg">Anda tidak dapat bergabung setelah kuis dimulai.</p>
            </div>
          )}
          {/* Finished */}
          {(status === 'finished' || resultData) && (
            <StudentRecap resultData={resultData} isTournament={isTournament} />
          )}
        </>
      )}
    </div>
  )
}
