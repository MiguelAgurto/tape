#!/usr/bin/env node
//
// Demo data — 5 entries for each seeded crew member, for eyeballing how the
// app behaves with realistic content.
//
//   node scripts/seed-entries.mjs           seed entries (and demo photos)
//   node scripts/seed-entries.mjs --clear   delete ALL entries and photos
//
// The data is deliberately varied: different people track different
// measurements, trends run both directions, some entries carry a photo and
// some don't, and one has no note. That exercises every branch the feed, the
// chart, and the delta screen can take.
//
// --clear removes *every* entry and *every* file in the photos bucket, not
// just the ones this script made. With real data present, that is destructive.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'

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
const BUCKET = env.VITE_APPWRITE_PHOTOS_BUCKET_ID

const authHeaders = { 'X-Appwrite-Project': PROJECT }
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

const rowsUrl = (table) => `${ENDPOINT}/tablesdb/${DATABASE}/tables/${table}/rows`
const filesUrl = `${ENDPOINT}/storage/buckets/${BUCKET}/files`
const limit = (n) => `queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [n] }))}`

async function api(url, init = {}) {
  const res = await fetch(url, { headers: jsonHeaders, ...init })
  const body = res.status === 204 ? null : await res.json()
  if (!res.ok) throw new Error(`${res.status} ${body?.message ?? res.statusText}`)
  return body
}

// --- a tiny PNG encoder, so demo photos need no binary assets or deps -------

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// A flat square in the person's colour — stands in for a progress photo.
function solidPng(size, hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    raw[row] = 0 // no per-scanline filter
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function uploadPhoto(color) {
  const png = solidPng(240, color)
  const form = new FormData()
  form.append('fileId', 'unique()')
  form.append('file', new Blob([png], { type: 'image/png' }), 'demo.png')
  const created = await api(filesUrl, { method: 'POST', headers: authHeaders, body: form })
  return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${created.$id}/view?project=${PROJECT}`
}

// --- clear -----------------------------------------------------------------

if (process.argv.includes('--clear')) {
  const { rows } = await api(`${rowsUrl('entries')}?${limit(100)}`)
  for (const r of rows) await api(`${rowsUrl('entries')}/${r.$id}`, { method: 'DELETE' })
  const { files } = await api(`${filesUrl}?${limit(100)}`)
  for (const f of files) await api(`${filesUrl}/${f.$id}`, { method: 'DELETE' })
  console.log(`Cleared ${rows.length} entries and ${files.length} photos.`)
  process.exit(0)
}

// --- the demo set ----------------------------------------------------------

// Five weekly dates, oldest first.
const DATES = ['2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25']

// Each person tracks a different combination, so the feed and the chart
// switcher don't look identical for everyone.
const PLAN = {
  Miguel: [
    { weight: 84.2, waist: 94.0, note: 'Starting point. Photo for the record.', photo: true },
    { weight: 83.1, waist: 93.1, note: 'Rough week, still showed up.' },
    { weight: 81.7, waist: 91.5, arm: 37.8, note: 'Added arm day.' },
    { weight: 80.6, waist: 90.2, arm: 38.1 },
    { weight: 79.9, waist: 89.4, arm: 38.5, note: 'Felt strong today 🔥', photo: true },
  ],
  Jose: [
    { weight: 88.9, chest: 103.0, note: 'Back at it after the break.' },
    { weight: 88.4, chest: 103.4, note: 'Eating properly again.' },
    { weight: 87.6, chest: 104.1, photo: true },
    { weight: 87.0, chest: 104.6, note: 'Bench finally moving.' },
    { weight: 86.4, chest: 105.2, note: 'Down 2.5 since July.' },
  ],
  // Bulking — weight and thigh climb, so deltas render in the "up" colour too.
  Helmut: [
    { weight: 74.1, thigh: 55.0, note: 'Bulk starts here.' },
    { weight: 74.6, thigh: 55.6, arm: 36.2, note: 'Leg day 🦵' },
    { weight: 75.0, thigh: 56.2, arm: 36.5 },
    { weight: 75.4, thigh: 57.0, arm: 36.9, note: 'Squats up 10kg.', photo: true },
    { weight: 75.8, thigh: 57.5, arm: 37.2, note: 'Trousers are a problem now.' },
  ],
}

const { rows: users } = await api(`${rowsUrl('users')}?${limit(100)}`)
if (users.length === 0) {
  console.error('No users found — run scripts/seed-users.mjs first.')
  process.exit(1)
}

let made = 0
for (const user of users) {
  const plan = PLAN[user.name]
  if (!plan) {
    console.log(`skipped  ${user.name} — no demo plan for this name`)
    continue
  }
  for (const [i, { note, photo, ...measurements }] of plan.entries()) {
    const data = { userId: user.$id, date: DATES[i], ...measurements }
    if (note) data.note = note
    if (photo) data.photoUrl = await uploadPhoto(user.color)
    await api(rowsUrl('entries'), {
      method: 'POST',
      body: JSON.stringify({ rowId: 'unique()', data }),
    })
    made++
  }
  console.log(`seeded   ${user.name.padEnd(7)} ${plan.length} entries`)
}

console.log(`\nDone — ${made} entries. Undo with: node scripts/seed-entries.mjs --clear`)
