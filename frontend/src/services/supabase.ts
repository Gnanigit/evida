import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Browser client using the publishable key. supabase-js persists the session
// in localStorage and refreshes the access token automatically.
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey)

// Used only for sign-up. It never stores a session, so creating an account
// does not sign the user in to the app; they sign in on the next page.
export const signUpClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'evida-sign-up',
  },
})
