import { useEffect, useState } from 'react'
import { supabase, npmToEmail } from './supabaseClient'
import MainApp from './MainApp'

const MIN_PW = 8

export default function App() {
  const [session, setSession]           = useState(null)
  const [profile, setProfile]           = useState(null)
  const [booting, setBooting]           = useState(true)
  const [profileDone, setProfileDone]   = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) setProfileDone(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setProfileDone(false); return }
    setProfileDone(false)
    supabase
      .from('profiles')
      .select('npm, name, class, is_admin, created_at')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setProfileDone(true)
      })
  }, [session])

  if (booting || (session && !profileDone)) {
    return (
      <div className="auth-bg">
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (session && profile) return <MainApp session={session} profile={profile} />

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

function AuthFlow() {
  const [step, setStep] = useState('npm')
  const [npm, setNpm] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const back = () => { setStep('npm'); setPw(''); setPw2(''); setError('') }

  async function checkNpm(e) {
    e.preventDefault()
    setError('')
    const clean = npm.trim()
    if (!clean) { setError('Please enter your NPM or ID.'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('npm_login_status', { p_npm: clean })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (data === 'not_whitelisted') { setError('This NPM is not on the whitelist.'); return }
    setNpm(clean)
    setStep(data === 'registered' ? 'login' : 'register')
  }

  async function doRegister(e) {
    e.preventDefault()
    setError('')
    if (pw.length < MIN_PW) { setError(`Password must be at least ${MIN_PW} characters.`); return }
    if (pw !== pw2) { setError('Passwords do not match.'); return }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email: npmToEmail(npm), password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (!data.session) setError('Account created — but no session returned. Disable email confirmation in Supabase → Auth → Providers → Email.')
  }

  async function doLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: npmToEmail(npm), password: pw })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon-lg">📊</div>
          <h1>IS Audit Journal</h1>
          <p>Information System Audit · PKN STAN</p>
        </div>

        {step === 'npm' && (
          <>
            <div className="auth-step">Masuk ke akun Anda</div>
            <p className="auth-title">Masukkan NPM</p>
            <form onSubmit={checkNpm}>
              <div className="form-group">
                <label>NPM / Student ID</label>
                <input autoFocus value={npm} onChange={e => setNpm(e.target.value)} placeholder="e.g. 4213250083" />
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Lanjutkan →'}</button>
            </form>
          </>
        )}

        {step === 'register' && (
          <>
            <div className="auth-step">Akun baru</div>
            <p className="auth-title">Buat password</p>
            <p className="auth-hint">Pertama kali masuk, <strong>{npm}</strong>. Buat password untuk akun Anda.</p>
            <form onSubmit={doRegister}>
              <div className="form-group">
                <label>Password baru</label>
                <input autoFocus type="password" value={pw} onChange={e => setPw(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Konfirmasi password</label>
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat Akun'}</button>
              <button type="button" className="btn btn-ghost" onClick={back}>← Gunakan NPM lain</button>
            </form>
          </>
        )}

        {step === 'login' && (
          <>
            <div className="auth-step">Selamat datang kembali</div>
            <p className="auth-title">Masuk</p>
            <p className="auth-hint">Halo, <strong>{npm}</strong>. Masukkan password Anda.</p>
            <form onSubmit={doLogin}>
              <div className="form-group">
                <label>Password</label>
                <input autoFocus type="password" value={pw} onChange={e => setPw(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
              <button type="button" className="btn btn-ghost" onClick={back}>← Gunakan NPM lain</button>
            </form>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  )
}
