#!/usr/bin/env node
//
// One-off crew seeder. Creates rows in the `users` table.
//
//   node scripts/seed-users.mjs "Miguel:#4f8cff:1234" "Ana:#ff6b6b:5678"
//
// Each argument is  name:color:pin  — color is a hex code, pin is 4 digits.
// Re-running with a name that already exists updates that person's colour and
// PIN rather than creating a duplicate.
//
// Reads config from .env (falling back to .env.example). No API key is needed:
// the users table is open to the "Any" role, which is the same access the
// browser has. Uses the REST endpoint directly so the script has no deps.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { hashPin } from '../src/lib/pin.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const file = ['.env', '.env.example'].map((f) => join(root, f)).find(existsSync)
  if (!file) throw new Error('No .env or .env.example found.')
  const env = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnv()
const ENDPOINT = env.VITE_APPWRITE_ENDPOINT
const PROJECT = env.VITE_APPWRITE_PROJECT_ID
const DATABASE = env.VITE_APPWRITE_DATABASE_ID

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': PROJECT,
}

const rowsUrl = `${ENDPOINT}/tablesdb/${DATABASE}/tables/users/rows`

async function api(url, init = {}) {
  const res = await fetch(url, { ...init, headers })
  const body = res.status === 204 ? null : await res.json()
  if (!res.ok) throw new Error(`${res.status} ${body?.message ?? res.statusText}`)
  return body
}

function parseArg(arg) {
  const [name, color, pin] = arg.split(':')
  if (!name || !color || !pin) {
    throw new Error(`Malformed "${arg}" — expected name:color:pin, e.g. Miguel:#4f8cff:1234`)
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`"${color}" is not a #rrggbb hex colour.`)
  if (!/^\d{4}$/.test(pin)) throw new Error(`PIN for ${name} must be exactly 4 digits.`)
  return { name, color, pin }
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: node scripts/seed-users.mjs "Name:#rrggbb:1234" [...]')
  process.exit(1)
}

// Validate every argument before touching the network, and report the problem
// as a one-line message rather than a stack trace.
let crew
try {
  crew = args.map(parseArg)
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

// Queries go over REST as JSON-encoded objects, not the SDK's limit(100) shorthand.
const limitQuery = encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] }))
const existing = await api(`${rowsUrl}?queries[]=${limitQuery}`)
const byName = new Map(existing.rows.map((r) => [r.name, r]))

for (const { name, color, pin } of crew) {
  const data = { name, color, pinHash: await hashPin(pin) }
  const found = byName.get(name)
  if (found) {
    await api(`${rowsUrl}/${found.$id}`, { method: 'PATCH', body: JSON.stringify({ data }) })
    console.log(`updated  ${name}  ${color}`)
  } else {
    await api(rowsUrl, { method: 'POST', body: JSON.stringify({ rowId: 'unique()', data }) })
    console.log(`created  ${name}  ${color}`)
  }
}

console.log(`\nDone — ${crew.length} crew member(s) seeded.`)
