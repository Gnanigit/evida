// When an email link (sign-up confirmation) fails, Supabase redirects back with
// #error=...&error_code=...&error_description=... in the URL. The route guard
// then redirects to /signin, which drops the hash, so it is read once here at
// startup (imported by main.tsx before the app renders) and the hash is cleared.

export type AuthLinkError = { code: string | null; message: string }

function readAuthLinkError(): AuthLinkError | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (!params.has('error') && !params.has('error_code')) return null

  // Remove the error from the address bar so a refresh doesn't show it again.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  const code = params.get('error_code')
  const message =
    code === 'otp_expired'
      ? 'This confirmation link is invalid or has expired. Links can only be used once — if you already confirmed, sign in. Otherwise, send yourself a new link below.'
      : params.get('error_description') || 'That email link could not be used. Please try again.'

  return { code, message }
}

export const authLinkError = readAuthLinkError()
