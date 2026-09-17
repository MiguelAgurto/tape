import { useEffect, useRef } from 'react'
import {
  client,
  DATABASE_ID,
  ENTRIES_TABLE,
  CHECKINS_TABLE,
  REACTIONS_TABLE,
  COMMENTS_TABLE,
} from './appwrite'

const WATCHED = [ENTRIES_TABLE, CHECKINS_TABLE, REACTIONS_TABLE, COMMENTS_TABLE]

// Channel strings for TablesDB take the `tablesdb.` prefix — the older
// `databases.` form is a different (and wrong) channel.
const CHANNELS = WATCHED.map((t) => `tablesdb.${DATABASE_ID}.tables.${t}.rows`)

// Event names look like `...tables.<table>.rows.<rowId>.<action>`. Read both
// ends rather than assuming the prefix, which has changed between versions.
function parse(event) {
  const names = event?.events ?? []
  for (const name of names) {
    for (const table of WATCHED) {
      const marker = `.tables.${table}.rows.`
      if (!name.includes(marker)) continue
      const action = name.slice(name.lastIndexOf('.') + 1)
      if (action === 'create' || action === 'update' || action === 'delete') {
        return { table, action, row: event.payload }
      }
    }
  }
  return null
}

// One subscription, mounted only by the feed. Realtime is purely additive: if
// the socket never opens, the feed still works from its fetch on mount, so
// nothing here is allowed to throw into render.
export function useCrewRealtime(onChange) {
  const ref = useRef(onChange)
  ref.current = onChange

  useEffect(() => {
    let unsub
    try {
      unsub = client.subscribe(CHANNELS, (event) => {
        const parsed = parse(event)
        if (parsed) ref.current(parsed)
      })
    } catch (err) {
      console.error('Realtime unavailable, falling back to fetch-on-open:', err)
    }
    // StrictMode double-mounts this in dev; without the teardown you get two
    // live handlers and every event applied twice.
    return () => {
      try {
        unsub?.()
      } catch (err) {
        console.error('Realtime teardown failed:', err)
      }
    }
  }, [])
}
