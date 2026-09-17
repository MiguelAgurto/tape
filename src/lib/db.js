// Data access for the tape backend.
//
// Everything the screens need lives here so the Appwrite specifics (row shapes,
// Query builders, pagination) stay in one place.
//
// Row shape reminders, since they differ from a typical SQL schema:
//   - the primary key is `$id`, not `id`
//   - insertion time is `$createdAt`
//   - `userId` is a plain string holding a user's `$id`; there are no joins, so
//     the feed stitches users in client-side
//   - a photo is a single `photoUrl` string on the row, not a separate table
//
// Note on ids: AuthContext hands screens a session user shaped `{ id, name,
// color }` — `id`, not `$id`. Every write below takes that `user.id` as its
// `userId`; every stitch keys on the row's `$id`. Mixing them up writes orphan
// rows that vanish from the feed without erroring.

import { ID, Query } from 'appwrite'
import {
  tables,
  storage,
  DATABASE_ID,
  USERS_TABLE,
  ENTRIES_TABLE,
  CHECKINS_TABLE,
  REACTIONS_TABLE,
  COMMENTS_TABLE,
  PHOTOS_BUCKET_ID,
  fileViewUrl,
} from './appwrite'
import { MEASUREMENT_KEYS } from './measurements'

const PAGE = 100

// How many posts of each kind the feed pulls before merging. Kept well under
// PAGE because the merged ids become a Query.equal array below, and Appwrite
// caps those at 100 values.
const FEED_PER_KIND = 20

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
// Measurements only: check-ins live in their own table and must never land
// here, or Tape's delta maths would compare against rows with no numbers.
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

// --- check-ins -------------------------------------------------------------

// The daily "I showed up" row. Same blank-omission discipline as createEntry:
// `activity`, `date` and `userId` are the only required columns, and an empty
// string sent to an optional column is a 400, not a silent null.
export async function createCheckin({ userId, date, activity, note, photoUrl, photoId }) {
  const data = { userId, date, activity }
  if (note) data.note = note
  if (photoUrl) data.photoUrl = photoUrl
  if (photoId) data.photoId = photoId
  return tables.createRow({
    databaseId: DATABASE_ID,
    tableId: CHECKINS_TABLE,
    rowId: ID.unique(),
    data,
  })
}

export async function listCheckinsForUser(userId) {
  return listAll(CHECKINS_TABLE, [
    Query.equal('userId', userId),
    Query.orderDesc('date'),
    Query.orderDesc('$createdAt'),
  ])
}

// Everyone's check-ins on one day — powers "who's in today".
export async function checkinsOnDate(date) {
  return listAll(CHECKINS_TABLE, [Query.equal('date', date), Query.orderDesc('$createdAt')])
}

export async function myCheckinsToday(userId, date) {
  return listAll(CHECKINS_TABLE, [Query.equal('userId', userId), Query.equal('date', date)])
}

// --- the feed --------------------------------------------------------------

// Reactions and comments hang off both entries and check-ins. Appwrite has no
// cross-column OR, so `(type = 'entry' AND id IN [...]) OR (type = 'checkin'
// AND id IN [...])` is not expressible — but one combined string column is,
// as a single indexed equality against an array. Hence targetKey.
//
// `$id` is only unique per table, so the type prefix is doing real work here,
// not just documenting.
export function targetKeyFor(kind, id) {
  return `${kind}:${id}`
}

function normalizeEntry(row, user) {
  const payload = {}
  for (const key of MEASUREMENT_KEYS) {
    if (row[key] != null) payload[key] = row[key]
  }
  return {
    kind: 'entry',
    id: row.$id,
    targetKey: targetKeyFor('entry', row.$id),
    userId: row.userId,
    user,
    date: row.date,
    createdAt: row.$createdAt,
    note: row.note ?? null,
    photoUrl: row.photoUrl ?? null,
    payload,
  }
}

function normalizeCheckin(row, user) {
  return {
    kind: 'checkin',
    id: row.$id,
    targetKey: targetKeyFor('checkin', row.$id),
    userId: row.userId,
    user,
    date: row.date,
    createdAt: row.$createdAt,
    note: row.note ?? null,
    photoUrl: row.photoUrl ?? null,
    // Only check-ins carry this; entries predate the column and can never
    // clean up the file they uploaded.
    photoId: row.photoId ?? null,
    payload: { activity: row.activity },
  }
}

// Newest first, by date then insertion time. Several posts share a date at
// daily cadence, so the $createdAt tiebreaker is load-bearing.
function newestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}

// Every reaction and comment for a page of posts, in exactly two requests
// regardless of how many posts there are. Grouping client-side is the price of
// having no joins; firing one query per post is not an acceptable alternative.
export async function loadSocial(targetKeys) {
  const reactionsByKey = new Map()
  const commentsByKey = new Map()
  // Query.equal with an empty array is a 400 — and an empty feed is the very
  // first state anything here gets tested in.
  if (!targetKeys.length) return { reactionsByKey, commentsByKey }

  const [reactions, comments] = await Promise.all([
    listAll(REACTIONS_TABLE, [Query.equal('targetKey', targetKeys)]),
    listAll(COMMENTS_TABLE, [Query.equal('targetKey', targetKeys), Query.orderAsc('$createdAt')]),
  ])

  for (const r of reactions) {
    const list = reactionsByKey.get(r.targetKey)
    if (list) list.push(r)
    else reactionsByKey.set(r.targetKey, [r])
  }
  for (const c of comments) {
    const list = commentsByKey.get(c.targetKey)
    if (list) list.push(c)
    else commentsByKey.set(c.targetKey, [c])
  }
  return { reactionsByKey, commentsByKey }
}

// The shared crew feed: measurements and check-ins interleaved, newest first,
// each with its author, reactions and comments attached.
//
// Taking the newest FEED_PER_KIND of each table and merging is exact, not an
// approximation: the top N of a union is always contained in the union of each
// side's top N.
export async function listFeed(limit = FEED_PER_KIND * 2) {
  const [entriesRes, checkinsRes, users] = await Promise.all([
    tables.listRows({
      databaseId: DATABASE_ID,
      tableId: ENTRIES_TABLE,
      queries: [
        Query.orderDesc('date'),
        Query.orderDesc('$createdAt'),
        Query.limit(FEED_PER_KIND),
      ],
    }),
    tables.listRows({
      databaseId: DATABASE_ID,
      tableId: CHECKINS_TABLE,
      queries: [
        Query.orderDesc('date'),
        Query.orderDesc('$createdAt'),
        Query.limit(FEED_PER_KIND),
      ],
    }),
    listUsers(),
  ])

  // The author can be missing if a user row was deleted while their posts
  // remain; every renderer downstream treats `user` as optional.
  const byId = new Map(users.map((u) => [u.$id, u]))
  const posts = [
    ...entriesRes.rows.map((r) => normalizeEntry(r, byId.get(r.userId) ?? null)),
    ...checkinsRes.rows.map((r) => normalizeCheckin(r, byId.get(r.userId) ?? null)),
  ]
    .sort(newestFirst)
    .slice(0, limit)

  const { reactionsByKey, commentsByKey } = await loadSocial(posts.map((p) => p.targetKey))

  return {
    users,
    posts: posts.map((p) => ({
      ...p,
      reactions: reactionsByKey.get(p.targetKey) ?? [],
      comments: commentsByKey.get(p.targetKey) ?? [],
    })),
  }
}

// --- reactions -------------------------------------------------------------

// One row per (targetKey, userId, emoji), enforced by the uniq_reaction index.
//
// `existing` is the row already in memory from the feed fetch — the batched
// load returns whole rows, not counts, so toggling off never needs a lookup.
export async function toggleReaction({ existing, post, userId, emoji }) {
  if (existing) {
    try {
      await tables.deleteRow({
        databaseId: DATABASE_ID,
        tableId: REACTIONS_TABLE,
        rowId: existing.$id,
      })
    } catch (err) {
      // Already gone (another device beat us to it) is the outcome we wanted.
      if (err?.code !== 404) throw err
    }
    return null
  }

  try {
    return await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: REACTIONS_TABLE,
      rowId: ID.unique(),
      data: {
        targetKey: post.targetKey,
        targetType: post.kind,
        targetId: post.id,
        userId,
        emoji,
      },
    })
  } catch (err) {
    // The unique index rejected a double-tap. The reaction is on either way —
    // fetch the winning row so local state matches the server.
    if (err?.code === 409) {
      const rows = await listAll(REACTIONS_TABLE, [
        Query.equal('targetKey', post.targetKey),
        Query.equal('userId', userId),
        Query.equal('emoji', emoji),
      ])
      return rows[0] ?? null
    }
    throw err
  }
}

// --- comments --------------------------------------------------------------

export async function addComment({ post, userId, body }) {
  return tables.createRow({
    databaseId: DATABASE_ID,
    tableId: COMMENTS_TABLE,
    rowId: ID.unique(),
    data: {
      targetKey: post.targetKey,
      targetType: post.kind,
      targetId: post.id,
      userId,
      body,
    },
  })
}

export async function deleteComment(commentId) {
  return tables.deleteRow({
    databaseId: DATABASE_ID,
    tableId: COMMENTS_TABLE,
    rowId: commentId,
  })
}

// --- deleting posts --------------------------------------------------------

// There is no server-side cascade without relationship columns, so a post's
// reactions and comments have to be swept by hand. Orphans would otherwise
// attach themselves to nothing forever.
async function deleteSocialFor(targetKey) {
  const [reactions, comments] = await Promise.all([
    listAll(REACTIONS_TABLE, [Query.equal('targetKey', targetKey)]),
    listAll(COMMENTS_TABLE, [Query.equal('targetKey', targetKey)]),
  ])
  await Promise.all([
    ...reactions.map((r) =>
      tables.deleteRow({ databaseId: DATABASE_ID, tableId: REACTIONS_TABLE, rowId: r.$id }),
    ),
    ...comments.map((c) =>
      tables.deleteRow({ databaseId: DATABASE_ID, tableId: COMMENTS_TABLE, rowId: c.$id }),
    ),
  ])
}

export async function deleteCheckin(checkinId) {
  await deleteSocialFor(targetKeyFor('checkin', checkinId))
  return tables.deleteRow({
    databaseId: DATABASE_ID,
    tableId: CHECKINS_TABLE,
    rowId: checkinId,
  })
}

export async function deleteEntry(entryId) {
  await deleteSocialFor(targetKeyFor('entry', entryId))
  return tables.deleteRow({
    databaseId: DATABASE_ID,
    tableId: ENTRIES_TABLE,
    rowId: entryId,
  })
}

// Delete a normalized feed post of either kind, and its photo with it.
//
// The row goes first: if the file delete fails afterwards we've leaked one
// orphan in the bucket, which is invisible. Doing it the other way round would
// leave a live post pointing at a photo that 404s, which is not.
export async function deletePost(post) {
  if (post.kind === 'checkin') await deleteCheckin(post.id)
  else await deleteEntry(post.id)

  if (post.photoId) {
    try {
      await storage.deleteFile({ bucketId: PHOTOS_BUCKET_ID, fileId: post.photoId })
    } catch (err) {
      console.error('Post deleted, but its photo could not be removed:', err)
    }
  }
}

// --- photos ----------------------------------------------------------------

// Upload a (usually already compressed) blob and return its public view URL.
// Callers should keep `fileId` alongside the URL where the schema has room for
// it — entries predate that and can never clean up their orphans.
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
