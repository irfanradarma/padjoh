import { useEffect, useState } from 'react'
import { supabase, npmToEmail } from './supabaseClient'

const MIN_PASSWORD = 8

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); return }
    supabase
      .from('profiles')
      .select('npm, name, class, is_admin, created_at')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  if (booting) return <Shell><p className="muted">Loading…</p></Shell>
  return session
    ? (profile?.is_admin ? <AdminDashboard session={session} /> : <Dashboard session={session} profile={profile} />)
    : <AuthFlow />
}

function AuthFlow() {
  const [step, setStep] = useState('npm')   // 'npm' | 'register' | 'login'
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
    if (pw.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return }
    if (pw !== pw2) { setError('Passwords do not match.'); return }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email: npmToEmail(npm), password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (!data.session) {
      setError('Account created, but no session was returned — make sure “Confirm email” is OFF in Supabase → Authentication → Providers → Email.')
    }
    // On success the auth listener in <App/> flips us to the dashboard.
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
    <Shell>
      <p className="eyebrow">Student Access</p>
      <h1>NPM Portal</h1>

      {step === 'npm' && (
        <form onSubmit={checkNpm} className="stack">
          <label>Your NPM
            <input autoFocus value={npm}
                   onChange={e => setNpm(e.target.value)} placeholder="e.g. 4213250083" />
          </label>
          <button disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      )}

      {step === 'register' && (
        <form onSubmit={doRegister} className="stack">
          <p className="muted">First time here, <strong>{npm}</strong>. Choose a password to create your account.</p>
          <label>New password
            <input autoFocus type="password" value={pw} onChange={e => setPw(e.target.value)} />
          </label>
          <label>Confirm password
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <button type="button" className="link" onClick={back}>← Use a different NPM</button>
        </form>
      )}

      {step === 'login' && (
        <form onSubmit={doLogin} className="stack">
          <p className="muted">Welcome back, <strong>{npm}</strong>.</p>
          <label>Password
            <input autoFocus type="password" value={pw} onChange={e => setPw(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="link" onClick={back}>← Use a different NPM</button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </Shell>
  )
}

function Dashboard({ session, profile }) {
  return (
    <Shell>
      <p className="eyebrow">Signed in</p>
      <h1>{profile?.name ?? profile?.npm ?? '…'}</h1>
      <p className="muted">You're authenticated. This is where your app begins.</p>
      <dl className="meta">
        <div><dt>NPM</dt><dd>{profile?.npm ?? '—'}</dd></div>
        <div><dt>Class</dt><dd>{profile?.class ?? '—'}</dd></div>
        <div><dt>User ID</dt><dd className="mono">{session.user.id}</dd></div>
      </dl>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </Shell>
  )
}

function AdminDashboard({ session }) {
  return (
    <Shell>
      <p className="eyebrow">Admin</p>
      <h1>Administrator</h1>
      <p className="muted">You are signed in as the system administrator.</p>
      <dl className="meta">
        <div><dt>User ID</dt><dd className="mono">{session.user.id}</dd></div>
      </dl>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <main className="page">
      <div className="card">{children}</div>
      <footer>Supabase · GitHub Pages</footer>
    </main>
  )
}
