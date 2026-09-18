import { createContext, useContext, useEffect, useState } from 'react'
import { getUser } from '../lib/db'
import { verifyPin } from '../lib/pin'
import { loadSession, saveSession, clearSession } from '../lib/session'
import { clearCache } from '../lib/cache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession())
  const [ready] = useState(true)

  // Keep localStorage in sync with the active user.
  useEffect(() => {
    if (user) saveSession(user)
  }, [user])

  // Verify a PIN client-side against the pinHash on that user's row.
  //
  // There is no Appwrite Auth here — "logging in" only decides which user this
  // device acts as. The row is re-fetched rather than trusting the copy from
  // the picker list, so a PIN changed on another device takes effect straight
  // away instead of after a reload.
  async function login(candidate, pin) {
    try {
      const row = await getUser(candidate.$id)
      const ok = await verifyPin(pin, row.pinHash)
      if (!ok) return false
      const u = { id: row.$id, name: row.name, color: row.color }
      setUser(u)
      saveSession(u)
      return true
    } catch (err) {
      console.error('PIN check failed:', err)
      return false
    }
  }

  function logout() {
    clearSession()
    // Otherwise the next person on this device sees the last one's feed flash
    // up before their own loads.
    clearCache()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
