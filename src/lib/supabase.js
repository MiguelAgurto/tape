import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surface misconfiguration early rather than failing with a vague network error.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false }, // We don't use Supabase Auth; PINs gate access.
})

export const PHOTO_BUCKET = 'photos'

// Public URL for a stored photo path.
export function photoUrl(path) {
  if (!path) return null
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}
