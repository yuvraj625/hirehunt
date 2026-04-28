import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import AuthModal from './AuthModal.jsx'
import JobCard from './JobCard.jsx'
import './styles.css'

// ── Toast notifications ──────────────────────────────
function Toasts({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

// ── Skeleton placeholder while loading ───────────────
function SkeletonCard() {
  return (
    <div className="job-card skeleton" aria-hidden="true">
      <div className="sk sk-short" />
      <div className="sk sk-title" />
      <div className="sk sk-full" />
      <div className="sk sk-mid" />
      <div className="sk sk-footer" />
    </div>
  )
}

// ── Site header ──────────────────────────────────────
function Header({ tab, setTab, onAuthOpen, user, onLogout, savedCount }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef()

  useEffect(() => {
    function close(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="site-header">
      <div className="header-brand">
        <span className="brand-icon">🎯</span>
        <span className="brand-name">HireHunt</span>
      </div>

      <nav className="header-nav" aria-label="Main navigation">
        <button
          className={`nav-btn${tab === 'browse' ? ' active' : ''}`}
          onClick={() => setTab('browse')}
        >
          Browse
        </button>
        <button
          className={`nav-btn${tab === 'saved' ? ' active' : ''}`}
          onClick={() => setTab('saved')}
        >
          Saved
          {savedCount > 0 && <span className="badge">{savedCount}</span>}
        </button>
      </nav>

      <div className="header-auth">
        {user ? (
          <div className="avatar-wrap" ref={menuRef}>
            <button
              className="avatar"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="avatar-menu" role="menu">
                <p className="menu-name">{user.name}</p>
                <p className="menu-email">{user.email}</p>
                <hr className="menu-divider" />
                <button role="menuitem" onClick={() => { onLogout(); setMenuOpen(false) }}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="header-login-btn" onClick={onAuthOpen}>Sign In</button>
        )}
      </div>
    </header>
  )
}

// ── Quick-phrase chips ───────────────────────────────
const PHRASES = [
  'I am looking for',
  "I'm looking for",
  'looking to hire',
  'seeking a developer',
  'need a designer',
  'hiring remotely',
]

// ── Browse tab ───────────────────────────────────────
function BrowseTab({ user, savedIds, onSave }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [phrase, setPhrase] = useState('I am looking for')
  const [input, setInput] = useState('I am looking for')
  const [sort, setSort] = useState('new')

  const doFetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs?q=${encodeURIComponent(phrase)}&sort=${sort}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs')
      setJobs(data)
    } catch (e) {
      setError(e.message)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [phrase, sort])

  useEffect(() => { doFetch() }, [doFetch])

  function handleSearch(e) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) setPhrase(trimmed)
  }

  function pickPhrase(p) {
    setInput(p)
    setPhrase(p)
  }

  return (
    <>
      <div className="controls">
        <form onSubmit={handleSearch} className="search-form" role="search">
          <input
            type="search"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search phrase…"
            className="search-input"
            aria-label="Search phrase"
          />
          <button type="submit" className="search-btn">Search</button>
        </form>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="sort-select"
          aria-label="Sort order"
        >
          <option value="new">New</option>
          <option value="hot">Hot</option>
          <option value="top">Top</option>
          <option value="relevance">Relevance</option>
        </select>
      </div>

      <div className="chips" role="group" aria-label="Quick phrases">
        {PHRASES.map(p => (
          <button
            key={p}
            className={`chip${phrase === p ? ' active' : ''}`}
            onClick={() => pickPhrase(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {!loading && !error && jobs.length > 0 && (
        <p className="results-info">{jobs.length} posts for &ldquo;{phrase}&rdquo;</p>
      )}

      {loading && (
        <div className="jobs-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {error && (
        <div className="error-box" role="alert">
          <span>⚠ {error}</span>
          <button onClick={doFetch}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="jobs-grid">
          {jobs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>No posts found for &ldquo;{phrase}&rdquo;</p>
              <span>Try a different phrase or sort order</span>
            </div>
          ) : (
            jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                onSave={onSave}
                isLoggedIn={!!user}
              />
            ))
          )}
        </div>
      )}
    </>
  )
}

// ── Saved tab ────────────────────────────────────────
function SavedTab({ saved, onSave, user, onAuthOpen }) {
  if (!user) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🔖</span>
        <p>Sign in to save jobs</p>
        <button className="header-login-btn" onClick={onAuthOpen}>Sign In</button>
      </div>
    )
  }
  if (saved.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🔖</span>
        <p>No saved jobs yet</p>
        <span>Hit &ldquo;Save&rdquo; on any job to bookmark it here</span>
      </div>
    )
  }
  return (
    <div className="jobs-grid">
      {saved.map(job => (
        <JobCard key={job.id} job={job} isSaved={true} onSave={onSave} isLoggedIn={true} />
      ))}
    </div>
  )
}

// ── Root app ─────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('hh_token'))
  const [saved, setSaved] = useState([])
  const [tab, setTab] = useState('browse')
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [toasts, setToasts] = useState([])

  const savedIds = useMemo(() => new Set(saved.map(j => j.id)), [saved])

  function addToast(msg, type = 'success') {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }

  function authHeader() {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function loadSaved(tok) {
    try {
      const res = await fetch('/api/saved', { headers: { Authorization: `Bearer ${tok}` } })
      if (res.ok) setSaved(await res.json())
    } catch { /* silent */ }
  }

  // Restore session on mount
  useEffect(() => {
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) { setUser(u); loadSaved(token) }
        else { localStorage.removeItem('hh_token'); setToken(null) }
      })
      .catch(() => { localStorage.removeItem('hh_token'); setToken(null) })
  }, []) // eslint-disable-line

  function handleAuthSuccess({ token: tok, user: u }) {
    localStorage.setItem('hh_token', tok)
    setToken(tok)
    setUser(u)
    setShowAuth(false)
    loadSaved(tok)
    addToast(`Welcome, ${u.name}! 👋`)
  }

  function logout() {
    localStorage.removeItem('hh_token')
    setToken(null)
    setUser(null)
    setSaved([])
    setTab('browse')
    addToast('Signed out successfully')
  }

  async function handleSave(job) {
    if (!user) {
      setAuthMode('login')
      setShowAuth(true)
      return
    }

    if (savedIds.has(job.id)) {
      setSaved(s => s.filter(j => j.id !== job.id))
      try {
        await fetch(`/api/saved/${job.id}`, { method: 'DELETE', headers: authHeader() })
        addToast('Removed from saved jobs')
      } catch {
        setSaved(s => [job, ...s])
        addToast('Could not unsave — try again', 'error')
      }
    } else {
      setSaved(s => [job, ...s])
      try {
        const res = await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(job),
        })
        if (!res.ok) throw new Error()
        addToast('Job saved!')
      } catch {
        setSaved(s => s.filter(j => j.id !== job.id))
        addToast('Could not save — try again', 'error')
      }
    }
  }

  return (
    <>
      <div className="app">
        <Header
          tab={tab}
          setTab={setTab}
          onAuthOpen={() => { setAuthMode('login'); setShowAuth(true) }}
          user={user}
          onLogout={logout}
          savedCount={saved.length}
        />

        <main className="main">
          {tab === 'browse' && (
            <BrowseTab user={user} savedIds={savedIds} onSave={handleSave} />
          )}
          {tab === 'saved' && (
            <SavedTab
              saved={saved}
              onSave={handleSave}
              user={user}
              onAuthOpen={() => { setAuthMode('login'); setShowAuth(true) }}
            />
          )}
        </main>
      </div>

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      <Toasts toasts={toasts} />
    </>
  )
}
