import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadSession, saveSession, clearSession } from '../lib/session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession())
  const [ready, setReady] = useState(true)

  // Keep localStorage in sync with the active user.
  useEffect(() => {
    if (user) saveSession(user)
  }, [user])

  // Verify a PIN via the Edge Function; on success, remember the user.
  async function login(candidate, pin) {
    const { data, error } = await supabase.functions.invoke('verify-pin', {
      body: { user_id: candidate.id, pin },
    })
    if (error || !data?.ok) return false
    const u = { id: candidate.id, name: candidate.name, color: candidate.color }
    setUser(u)
    saveSession(u)
    return true
  }

  function logout() {
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
