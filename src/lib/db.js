// Data access for the tape backend.
//
// Everything the screens need lives here so the Appwrite specifics (row shapes,
// Query builders, pagination) stay in one place.
//
// Row shape reminders, since they differ from a typical SQL schema:
//   - the primary key is `$id`, not `id`
//   - insertion time is `$createdAt`
//   - `entries.userId` is a plain string holding a user's `$id`; there are no
//     joins, so the feed stitches users in client-side
//   - a photo is a single `photoUrl` string on the entry, not a separate table

import { ID, Query } from 'appwrite'
import {
  tables,
  storage,
  DATABASE_ID,
  USERS_TABLE,
  ENTRIES_TABLE,
  PHOTOS_BUCKET_ID,
  fileViewUrl,
} from './appwrite'
import { MEASUREMENT_KEYS } from './measurements'

const PAGE = 100

// listRows caps out at 100 rows per call, so walk pages until exhausted.
async function listAll(tableId, queries = []) {
  const out = []
  let cursor = null
  for (;;) {
    const q = [...queries, Query.limit(PAGE)]
    if (cursor) q.push(Query.cursorAfter(cursor))
    const res = await tables.listRows({ databaseId: DATABASE_ID, tableId, queries: q })
    out.push(...res.rows)
    if (res.rows.length < PAGE) break
    cursor = res.rows[res.rows.length - 1].$id
  }
  return out
}

// --- users -----------------------------------------------------------------

export async function listUsers() {
  return listAll(USERS_TABLE, [Query.orderAsc('name')])
}

export async function getUser(userId) {
  return tables.getRow({ databaseId: DATABASE_ID, tableId: USERS_TABLE, rowId: userId })
}

// --- entries ---------------------------------------------------------------

// One person's history, oldest first — the order the chart wants.
export async function listEntriesForUser(userId) {
  return listAll(ENTRIES_TABLE, [
    Query.equal('userId', userId),
    Query.orderAsc('date'),
    Query.orderAsc('$createdAt'),
  ])
}

// The single most recent entry for a person, used to compute deltas.
// `date` is YYYY-MM-DD so it sorts correctly as a string; $createdAt breaks
// ties when several entries share a date.
export async function latestEntryForUser(userId) {
  const res = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: ENTRIES_TABLE,
    queries: [
      Query.equal('userId', userId),
      Query.orderDesc('date'),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ],
  })
  return res.rows[0] ?? null
}

// The shared crew feed: newest first, with each entry's author attached.
export async function listFeed(limit = 100) {
  const [res, users] = await Promise.all([
    tables.listRows({
      databaseId: DATABASE_ID,
      tableId: ENTRIES_TABLE,
      queries: [Query.orderDesc('date'), Query.orderDesc('$createdAt'), Query.limit(limit)],
    }),
    listUsers(),
  ])
  const byId = new Map(users.map((u) => [u.$id, u]))
  return res.rows.map((e) => ({ ...e, user: byId.get(e.userId) ?? null }))
}

export async function createEntry({ userId, date, note, photoUrl, measurements }) {
  const data = { userId, date }
  // Appwrite rejects unknown columns, so only send the ones that exist, and
  // omit blanks entirely rather than writing nulls.
  if (note) data.note = note
  if (photoUrl) data.photoUrl = photoUrl
  for (const key of MEASUREMENT_KEYS) {
    const v = measurements?.[key]
    if (v != null && v !== '' && Number.isFinite(Number(v))) data[key] = Number(v)
  }
  return tables.createRow({
    databaseId: DATABASE_ID,
    tableId: ENTRIES_TABLE,
    rowId: ID.unique(),
    data,
  })
}

export async function updateEntryPhoto(entryId, photoUrl) {
  return tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: ENTRIES_TABLE,
    rowId: entryId,
    data: { photoUrl },
  })
}

// --- photos ----------------------------------------------------------------

// Upload a (usually already compressed) blob and return its public view URL.
export async function uploadPhoto(blob, filename) {
  const file =
    blob instanceof File ? blob : new File([blob], filename, { type: blob.type || 'image/jpeg' })
  const created = await storage.createFile({
    bucketId: PHOTOS_BUCKET_ID,
    fileId: ID.unique(),
    file,
  })
  return { fileId: created.$id, url: fileViewUrl(created.$id) }
}
