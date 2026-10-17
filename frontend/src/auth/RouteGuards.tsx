import { Fragment } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

function RestoringSession() {
  return (
    <main className="centered-page">
      <p className="muted">Loading…</p>
    </main>
  )
}

// Renders child routes only for a signed-in user.
export function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()

  if (session === undefined) return <RestoringSession />

  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  // Keyed by user so no state survives a switch to a different account.
  return (
    <Fragment key={session.user.id}>
      <Outlet />
    </Fragment>
  )
}

// Sign-in and sign-up pages: signed-in users go straight to the app.
export function RedirectIfSignedIn() {
  const { session } = useAuth()
  const location = useLocation()

  if (session === undefined) return <RestoringSession />

  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/signin' && from !== '/signup' ? from : '/'} replace />
  }

  return <Outlet />
}
