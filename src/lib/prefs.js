// Per-user UI preferences, kept on the device only.
//
// Right now that's just "which measurements do I usually log" — the log form
// starts with the set you used last time rather than throwing all six at you.
// Keyed by user id so several crew members can share a phone.

import { MEASUREMENT_KEYS } from './measurements'

const KEY = 'tape.prefs'
const DEFAULT_FIELDS = ['weight']

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function loadFields(userId) {
  const saved = readAll()[userId]?.fields
  if (!Array.isArray(saved)) return DEFAULT_FIELDS
  // Drop anything unrecognised, and never hand back an empty form.
  const clean = saved.filter((k) => MEASUREMENT_KEYS.includes(k))
  return clean.length ? clean : DEFAULT_FIELDS
}

export function saveFields(userId, fields) {
  try {
    const all = readAll()
    all[userId] = { ...all[userId], fields }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // A full or disabled localStorage shouldn't break logging an entry.
  }
}
