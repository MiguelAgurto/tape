#!/usr/bin/env node
//
// Demo activity — a week of check-ins for the crew, plus reactions and replies
// on them, so the feed can be eyeballed at realistic density before three
// humans have actually used it for a week.
//
//   node scripts/seed-checkins.mjs           seed check-ins, reactions, comments
//   node scripts/seed-checkins.mjs --clear   delete ALL check-ins, reactions, comments
//
// Dates are computed relative to today so the newest check-ins always land on
// "today" and the today strip has something to light up.
//
// --clear removes *every* row in those three tables, not just the ones this
// script made. With real data present, that is destructive. Note that
// seed-entries.mjs --clear knows nothing about reactions and comments, so
// clearing entries there leaves social rows pointing at nothing — run this
// script's --clear alongside it.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

const jsonHeaders = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' }

const rowsUrl = (table) => `${ENDPOINT}/tablesdb/${DATABASE}/tables/${table}/rows`
const limit = (n) =>
  `queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [n] }))}`

async function api(url, init = {}) {
  const res = await fetch(url, { headers: jsonHeaders, ...init })
  const body = res.status === 204 ? null : await res.json()
  if (!res.ok) throw new Error(`${res.status} ${body?.message ?? res.statusText}`)
  return body
}

const create = (table, data) =>
  api(rowsUrl(table), { method: 'POST', body: JSON.stringify({ rowId: 'unique()', data }) })

// --- clear -----------------------------------------------------------------

if (process.argv.includes('--clear')) {
  let total = 0
  for (const table of ['checkins', 'reactions', 'comments']) {
    const { rows } = await api(`${rowsUrl(table)}?${limit(100)}`)
    for (const r of rows) await api(`${rowsUrl(table)}/${r.$id}`, { method: 'DELETE' })
    console.log(`cleared  ${table.padEnd(10)} ${rows.length}`)
    total += rows.length
  }
  console.log(`\nCleared ${total} rows.`)
  process.exit(0)
}

// --- the demo set ----------------------------------------------------------

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

// [days ago, activity, note?]. Deliberately uneven: Helmut has missed today,
// so the today strip renders a gap, and Miguel has two sessions on one day so
// the "more than one check-in" path gets exercised.
const PLAN = {
  Miguel: [
    [4, 'gym', 'Push day. Bench is moving again.'],
    [3, 'run', '5k, easy pace.'],
    [1, 'gym'],
    [0, 'gym', 'Legs. Regretting it already.'],
    [0, 'walk', 'Evening walk to undo the legs.'],
  ],
  Jose: [
    [4, 'ride', '40k with the club.'],
    [2, 'gym', 'Back and biceps.'],
    [1, 'rest', 'Rest day, properly this time.'],
    [0, 'gym', 'In and out in 45 minutes.'],
  ],
  Helmut: [
    [5, 'sport', 'Five-a-side. Lost badly.'],
    [3, 'gym', 'Squats up 10kg 🦵'],
    [2, 'run'],
    [1, 'gym', 'Deadlifts.'],
  ],
}

// Who reacts to whom, keyed by the author of the check-in being reacted to.
const REACTIONS = ['🔥', '💪', '👏', '😂']

const REPLIES = [
  'Beast.',
  'Meanwhile I am on the sofa.',
  'Same time tomorrow?',
  'Post the numbers or it did not happen.',
  'Respect 👏',
]

const { rows: users } = await api(`${rowsUrl('users')}?${limit(100)}`)
if (users.length === 0) {
  console.error('No users found — run scripts/seed-users.mjs first.')
  process.exit(1)
}

const made = []
for (const user of users) {
  const plan = PLAN[user.name]
  if (!plan) {
    console.log(`skipped  ${user.name} — no demo plan for this name`)
    continue
  }
  for (const [ago, activity, note] of plan) {
    const data = { userId: user.$id, date: daysAgo(ago), activity }
    if (note) data.note = note
    const row = await create('checkins', data)
    made.push({ row, author: user })
  }
  console.log(`seeded   ${user.name.padEnd(7)} ${plan.length} check-ins`)
}

// Reactions and replies from *other* people — nobody cheers their own session.
let reactions = 0
let comments = 0
for (const [i, { row, author }] of made.entries()) {
  const others = users.filter((u) => u.$id !== author.$id)
  const targetKey = `checkin:${row.$id}`
  const shared = { targetKey, targetType: 'checkin', targetId: row.$id }

  // Roughly two thirds of check-ins get at least one reaction.
  for (const [j, other] of others.entries()) {
    if ((i + j) % 3 === 0) continue
    await create('reactions', { ...shared, userId: other.$id, emoji: REACTIONS[(i + j) % 4] })
    reactions++
  }

  // Every third check-in picks up a reply.
  if (i % 3 === 1) {
    await create('comments', {
      ...shared,
      userId: others[i % others.length].$id,
      body: REPLIES[i % REPLIES.length],
    })
    comments++
  }
}

console.log(
  `\nDone — ${made.length} check-ins, ${reactions} reactions, ${comments} replies.` +
    `\nUndo with: node scripts/seed-checkins.mjs --clear`,
)
