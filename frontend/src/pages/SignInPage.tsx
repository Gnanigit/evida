import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import Brand from '../components/common/Brand'
import { useAuth } from '../auth/AuthContext'
import { describeAuthError } from '../auth/authErrors'
import { supabase } from '../services/supabase'

export default function SignInPage() {
  const { sessionExpired } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    // On success the auth listener updates the session and the route redirects.
    if (signInError) {
      setError(describeAuthError(signInError))
      setSubmitting(false)
    }
  }

  return (
    <main className="centered-page">
      <div className="card">
        <Brand large />
        <h1>Sign in to Evida</h1>

        {sessionExpired && !error && (
          <p className="alert">Your session has expired. Please sign in again.</p>
        )}
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted small form-footer">
          New to Evida? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  )
}
