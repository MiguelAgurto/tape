// Local "who am I" persistence. After the first successful PIN entry we remember
// the user in localStorage so they don't re-enter it on every visit.

const KEY = 'tape.session'

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.id || !parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(user) {
  const { id, name, color } = user
  localStorage.setItem(KEY, JSON.stringify({ id, name, color }))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
