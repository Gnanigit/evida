import type { AuthError } from '@supabase/supabase-js'

// Turn Supabase Auth errors into messages a user can act on.
export function describeAuthError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_not_confirmed':
      return 'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'signup_disabled':
      return 'New sign-ups are currently disabled.'
  }

  if (error.name === 'AuthRetryableFetchError') {
    return 'Could not reach the authentication service. Check your connection and try again.'
  }

  return error.message || 'Something went wrong. Please try again.'
}
