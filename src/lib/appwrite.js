// Appwrite client wiring.
//
// The backend is pre-built and used as-is: two tables (users, entries) and one
// storage bucket (photos), all open to the "Any" role. No Appwrite Auth is
// involved — see AuthContext for the PIN-based "who am I" flow.

import { Client, TablesDB, Storage } from 'appwrite'

const env = import.meta.env

export const ENDPOINT = env.VITE_APPWRITE_ENDPOINT
export const PROJECT_ID = env.VITE_APPWRITE_PROJECT_ID
export const DATABASE_ID = env.VITE_APPWRITE_DATABASE_ID
export const PHOTOS_BUCKET_ID = env.VITE_APPWRITE_PHOTOS_BUCKET_ID

// Table IDs are stable strings in the existing backend.
export const USERS_TABLE = 'users'
export const ENTRIES_TABLE = 'entries'

const missing = Object.entries({
  VITE_APPWRITE_ENDPOINT: ENDPOINT,
  VITE_APPWRITE_PROJECT_ID: PROJECT_ID,
  VITE_APPWRITE_DATABASE_ID: DATABASE_ID,
  VITE_APPWRITE_PHOTOS_BUCKET_ID: PHOTOS_BUCKET_ID,
})
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missing.length) {
  // Surface misconfiguration loudly — otherwise this fails later as a vague 401.
  console.error(
    `Missing Appwrite env vars: ${missing.join(', ')}. ` +
      'Copy .env.example to .env locally, or set them in Netlify.',
  )
}

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID)

export const tables = new TablesDB(client)
export const storage = new Storage(client)

// Public view URL for an uploaded photo.
//
// Built by hand rather than via storage.getFileView() because an <img> tag loads
// this with no SDK headers attached — the ?project= query param is what makes an
// unauthenticated request resolve against the right project.
export function fileViewUrl(fileId) {
  if (!fileId) return null
  return (
    `${ENDPOINT}/storage/buckets/${PHOTOS_BUCKET_ID}` +
    `/files/${encodeURIComponent(fileId)}/view?project=${PROJECT_ID}`
  )
}
