// What a check-in can be. Mirrors the shape of measurements.js.
//
// `activity` is a plain string column, not an Appwrite enum, so adding a row
// here is the whole change — no schema migration. The flip side is that an old
// cached PWA client can write a key this build has never heard of, which is
// why activityFor() always returns something renderable.
export const ACTIVITIES = [
  { key: 'gym', label: 'Gym', emoji: '🏋️' },
  { key: 'run', label: 'Run', emoji: '🏃' },
  { key: 'ride', label: 'Ride', emoji: '🚴' },
  { key: 'sport', label: 'Sport', emoji: '⚽' },
  { key: 'walk', label: 'Walk', emoji: '🚶' },
  { key: 'rest', label: 'Rest', emoji: '😌' },
]

export const ACTIVITY_KEYS = ACTIVITIES.map((a) => a.key)

const byKey = new Map(ACTIVITIES.map((a) => [a.key, a]))

const UNKNOWN = { key: '', label: 'Trained', emoji: '✅' }

export function activityFor(key) {
  return byKey.get(key) ?? UNKNOWN
}
