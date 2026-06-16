import { useEffect, useState } from 'react'
import { supabase, npmToEmail } from './supabaseClient'
import MainApp from './MainApp'
import AppLogo from './components/AppLogo'

const MIN_PW = 8

;(function () {
  const t = localStorage.getItem('theme') || 'dark'
  document.documentElement.setAttribute('data-theme', t)
})()

export default function App() {
  const [session, setSession]         = useState(null)
  const [profile, setProfile]         = useState(null)
  const [booting, setBooting]         = useState(true)
  const [profileDone, setProfileDone] = useState(false)
  const [theme, setTheme]             = useState(() => localStorage.getItem('theme') || 'dark')

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) setProfileDone(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setProfileDone(false); return }
    setProfileDone(false)
    supabase.rpc('get_my_profile').then(({ data, error }) => {
      if (error) console.error('Profile RPC error:', error)
      setProfile(data ?? null)
      setProfileDone(true)
    })
  }, [session?.user?.id])

  if (booting || (session && !profileDone)) {
    return (
      <div className="auth-bg">
        <div className="auth-loading">
          <div className="auth-loading-spinner" />
          <span>Memuat…</span>
        </div>
      </div>
    )
  }

  if (session && profile) return <MainApp session={session} profile={profile} theme={theme} toggleTheme={toggleTheme} />

  if (session && !profile) {
    return (
      <div className="auth-bg">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: 'var(--text)', fontWeight: 600, margin: '0 0 8px' }}>Profil tidak ditemukan</p>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
            Akun Anda belum memiliki profil. Silakan hubungi administrator.
          </p>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </div>
    )
  }

  return <AuthFlow />
}

function EyeIcon({ open }) {
  return open
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}

function PwInput({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-input-wrap">
      <input
        autoFocus={autoFocus}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pw-input"
      />
      <button type="button" className="pw-toggle" onClick={() => setShow(x => !x)} tabIndex={-1} aria-label={show ? 'Sembunyikan password' : 'Lihat password'}>
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

function StepDots({ step }) {
  const steps = ['NPM', 'Password']
  const current = step === 'npm' ? 0 : 1
  return (
    <div className="auth-step-dots">
      {steps.map((label, i) => (
        <div key={i} className={`auth-dot${i === current ? ' active' : i < current ? ' done' : ''}`}>
          <div className="auth-dot-circle">{i < current ? '✓' : i + 1}</div>
          <span className="auth-dot-label">{label}</span>
        </div>
      ))}
      <div className="auth-dot-line" />
    </div>
  )
}

async function logLogin() {
  const { error } = await supabase.rpc('log_my_login')
  if (error) console.warn('log_my_login error:', error.message)
}

function AuthFlow() {
  const [step, setStep] = useState('npm')
  const [npm, setNpm]   = useState('')
  const [pw, setPw]     = useState('')
  const [pw2, setPw2]   = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const back = () => { setStep('npm'); setPw(''); setPw2(''); setError('') }

  async function checkNpm(e) {
    e.preventDefault()
    setError('')
    const clean = npm.trim()
    if (!clean) { setError('Masukkan NPM atau ID Anda.'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('npm_login_status', { p_npm: clean })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (data === 'not_whitelisted') { setError('NPM ini tidak terdaftar dalam sistem. Hubungi administrator.'); return }
    setNpm(clean)
    setStep(data === 'registered' ? 'login' : 'register')
  }

  async function doRegister(e) {
    e.preventDefault()
    setError('')
    if (pw.length < MIN_PW) { setError(`Password minimal ${MIN_PW} karakter.`); return }
    if (pw !== pw2) { setError('Password tidak cocok.'); return }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email: npmToEmail(npm), password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (!data.session) {
      setError('Akun dibuat, tapi sesi tidak ditemukan. Nonaktifkan konfirmasi email di Supabase → Auth → Providers → Email.')
      return
    }
    void logLogin()
  }

  async function doLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: npmToEmail(npm), password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    void logLogin()
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon-lg"><AppLogo size={34} /></div>
          <h1>IS Audit Journal</h1>
          <p>Information System Audit · PKN STAN</p>
        </div>

        <StepDots step={step} />

        {step === 'npm' && (
          <>
            <p className="auth-title">Masuk ke akun Anda</p>
            <form onSubmit={checkNpm}>
              <div className="form-group">
                <label>NPM / Student ID</label>
                <input
                  autoFocus
                  value={npm}
                  onChange={e => setNpm(e.target.value)}
                  placeholder="Contoh: 4213250083"
                />
              </div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Memeriksa…' : 'Lanjutkan →'}
              </button>
            </form>
            <p className="auth-footnote">Hubungi dosen atau admin jika NPM Anda tidak dikenali.</p>
          </>
        )}

        {step === 'register' && (
          <>
            <div className="auth-who-card">
              <span className="auth-who-label">NPM</span>
              <span className="auth-who-value">{npm}</span>
            </div>
            <p className="auth-title">Buat password</p>
            <p className="auth-hint">Pertama kali masuk. Buat password unik untuk akun Anda.</p>
            <form onSubmit={doRegister}>
              <div className="form-group">
                <label>Password baru</label>
                <PwInput autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder={`Minimal ${MIN_PW} karakter`} />
              </div>
              <div className="form-group">
                <label>Konfirmasi password</label>
                <PwInput value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Ulangi password" />
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat Akun'}</button>
              <button type="button" className="btn btn-ghost" onClick={back}>← Ganti NPM</button>
            </form>
          </>
        )}

        {step === 'login' && (
          <>
            <div className="auth-who-card">
              <span className="auth-who-label">NPM</span>
              <span className="auth-who-value">{npm}</span>
            </div>
            <p className="auth-title">Masukkan password</p>
            <form onSubmit={doLogin}>
              <div className="form-group">
                <label>Password</label>
                <PwInput autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Password Anda" />
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
              <button type="button" className="btn btn-ghost" onClick={back}>← Ganti NPM</button>
            </form>
          </>
        )}

        {error && <div className="auth-error">⚠ {error}</div>}
      </div>
    </div>
  )
}
