// PIN hashing — salted SHA-256 via Web Crypto (also available in Node ≥18 as
// globalThis.crypto, so the seed script imports this same file).
//
// Stored format, all in the single `pinHash` column:
//
//     sha256$<saltHex>$<digestHex>
//
// SECURITY, STATED PLAINLY: this is a soft lock, not real security. A 4-digit
// PIN is 10,000 possibilities, and the users table is readable by the "Any"
// role — so anyone with the project ID can fetch a hash and brute-force it
// offline in well under a second. The salt only stops one precomputed table
// from cracking every crew member at once. This keeps friends out of each
// other's logs; it does not protect the data from a motivated stranger.

const PREFIX = 'sha256'

// 8 bytes → 16 hex chars, keeping the stored string at
//   "sha256$" (7) + 16 + "$" (1) + 64 = 88 chars.
// The existing pinHash column is capped at 100 chars and must not be altered,
// so this budget is fixed. 64 bits of salt is ample for de-duplicating hashes
// across a handful of crew members.
const SALT_BYTES = 8

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

async function digest(pin, saltBytes) {
  const data = new Uint8Array([...saltBytes, ...new TextEncoder().encode(String(pin))])
  const buf = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(buf))
}

// Hash a PIN with a fresh random salt. Used when seeding a user.
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hex = await digest(pin, salt)
  return `${PREFIX}$${toHex(salt)}$${hex}`
}

// Check a candidate PIN against a stored hash. Never throws on malformed
// input — a bad record reads as "wrong PIN" rather than crashing the login.
export async function verifyPin(pin, stored) {
  try {
    if (typeof stored !== 'string') return false
    const [scheme, saltHex, expected] = stored.split('$')
    if (scheme !== PREFIX || !saltHex || !expected) return false
    const actual = await digest(pin, fromHex(saltHex))
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// Constant-time-ish string compare. Largely ceremonial here (the attacker can
// just read the hash), but it costs nothing and avoids a sloppy pattern.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
