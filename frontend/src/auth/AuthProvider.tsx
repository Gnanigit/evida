import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SESSION_EXPIRED_EVENT } from '../services/api'
import { supabase } from '../services/supabase'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    // Fires INITIAL_SESSION with the restored session, then on every sign-in,
    // sign-out, and token refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        setSessionExpired(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleExpired() {
      setSessionExpired(true)
      void supabase.auth.signOut({ scope: 'local' })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
  }, [])

  const signOut = useCallback(async () => {
    setSessionExpired(false)
    const { error } = await supabase.auth.signOut()
    if (error) {
      // Still clear the local session if the server could not be reached.
      await supabase.auth.signOut({ scope: 'local' })
    }
  }, [])

  const value = useMemo(
    () => ({ session, sessionExpired, signOut }),
    [session, sessionExpired, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
