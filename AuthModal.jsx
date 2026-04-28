import { useState } from 'react'

export default function AuthModal({ mode: initialMode = 'login', onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function switchMode(m) {
    setMode(m)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'register' && password !== confirm) {
      return setError("Passwords don't match")
    }
    setError(null)
    setLoading(true)
    try {
      const body = mode === 'login' ? { email, password } : { name, email, password }
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      onSuccess(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-brand">
          <span className="brand-icon">🎯</span>
          <span className="brand-name">HireHunt</span>
        </div>

        <h2 className="modal-heading">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>

        <div className="modal-tabs">
          <button className={mode === 'login' ? 'mtab active' : 'mtab'} onClick={() => switchMode('login')}>
            Sign In
          </button>
          <button className={mode === 'register' ? 'mtab active' : 'mtab'} onClick={() => switchMode('register')}>
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {mode === 'register' && (
            <label className="field">
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus={mode === 'login'}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
              required
            />
          </label>

          {mode === 'register' && (
            <label className="field">
              <span>Confirm Password</span>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
              />
            </label>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="modal-footer-text">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className="link-btn" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}
