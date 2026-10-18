import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import Brand from '../components/common/Brand'
import { describeAuthError } from '../auth/authErrors'
import { supabase } from '../services/supabase'

// Supabase's default minimum; the project's password policy is enforced server-side.
const MIN_PASSWORD_LENGTH = 6

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (submitting) return

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    const trimmedEmail = email.trim()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })

    if (signUpError) {
      setError(describeAuthError(signUpError))
      setSubmitting(false)
      return
    }

    // With email confirmation enabled, Supabase hides existing accounts by
    // returning a user with no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      setError('An account with this email already exists. Try signing in instead.')
      setSubmitting(false)
      return
    }

    // A session means confirmation is disabled: the auth listener signs the user in.
    if (!data.session) {
      setConfirmationEmail(trimmedEmail)
      setSubmitting(false)
    }
  }

  if (confirmationEmail) {
    return (
      <main className="centered-page">
        <div className="card">
          <Brand large />
          <h1>Check your email</h1>
          <p>
            We sent a confirmation link to <strong>{confirmationEmail}</strong>. Open it to
            activate your account, then sign in.
          </p>
          <Link to="/signin" className="button">
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="centered-page">
      <div className="card">
        <Brand large />
        <h1>Create your Evida account</h1>

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
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="muted small form-footer">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
