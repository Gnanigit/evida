import { useState, type SubmitEvent } from 'react'
import { Link, useLocation } from 'react-router'
import Brand from '../components/common/Brand'
import { useAuth } from '../auth/AuthContext'
import { describeAuthError } from '../auth/authErrors'
import { authLinkError } from '../auth/authLinkError'
import { supabase } from '../services/supabase'

export default function SignInPage() {
  const { sessionExpired } = useAuth()
  // Set by the sign-up page after a new account is created.
  const accountCreated = (useLocation().state as { accountCreated?: string } | null)
    ?.accountCreated
  const [email, setEmail] = useState(accountCreated ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A failed confirmation link: offer to send a new one.
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendError, setResendError] = useState<string | null>(null)

  async function resendConfirmation() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setResendError('Enter your email above, then send the link.')
      return
    }
    setResendState('sending')
    setResendError(null)
    const { error: resendFailure } = await supabase.auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (resendFailure) {
      setResendError(describeAuthError(resendFailure))
      setResendState('idle')
    } else {
      setResendState('sent')
    }
  }

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

        {accountCreated && !error && (
          <p className="alert alert-success" role="status">
            Account created. Sign in to get started.
          </p>
        )}
        {authLinkError && !error && (
          <div className="alert alert-error alert-stack" role="alert">
            <p className="alert-text">{authLinkError.message}</p>
            {resendState === 'sent' ? (
              <p className="alert-text">
                A new confirmation link is on its way to <strong>{email.trim()}</strong>.
              </p>
            ) : (
              <button
                type="button"
                className="text-button"
                onClick={() => void resendConfirmation()}
                disabled={resendState === 'sending'}
              >
                {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
              </button>
            )}
            {resendError && <p className="alert-text">{resendError}</p>}
          </div>
        )}
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
