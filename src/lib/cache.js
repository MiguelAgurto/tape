// Stale-while-revalidate cache in localStorage.
//
// Both round trips to Appwrite are ~300-400ms each, and nothing can make them
// faster from here. What this does is remove them from the critical path on a
// return visit: paint whatever was on screen last time, immediately, then
// replace it when the fetch lands.
//
// Everything here is deliberately failure-tolerant. A cache that throws is
// worse than no cache at all — Safari's private mode throws on setItem, quota
// can fill, and a shape change between deploys leaves unreadable JSON behind.

const PREFIX = 'tape.cache.'

// Bump when a cached shape changes, so old entries are ignored rather than
// rendered into a component that no longer understands them.
const VERSION = 2

// Past this, don't paint from cache at all. Not about correctness — the fetch
// always replaces it — but a feed from last week flashing up is disorienting.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

// localStorage is a few MB and shared with the session and prefs. A feed page
// is tens of KB; anything near this cap means something has gone wrong.
const MAX_BYTES = 512 * 1024

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.v !== VERSION) return null
    if (!parsed.t || Date.now() - parsed.t > MAX_AGE_MS) return null
    return parsed.d ?? null
  } catch {
    return null
  }
}

export function writeCache(key, data) {
  try {
    const raw = JSON.stringify({ v: VERSION, t: Date.now(), d: data })
    if (raw.length > MAX_BYTES) return
    localStorage.setItem(PREFIX + key, raw)
  } catch {
    // Quota exceeded, private mode, or an unserialisable value. A missing
    // cache entry costs a spinner; a thrown one costs the render.
  }
}

// Called on sign-out: the next person on this device should not see the last
// one's feed flash up before their own loads.
export function clearCache() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    // Nothing to do — an unreadable store is already effectively cleared.
  }
}
