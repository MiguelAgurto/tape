// The measurement fields tracked in v1. Units are hardcoded (kg/cm) for now.
//
// Icons are drawn by <Icon name={key} /> — see components/Icon.jsx. They're
// keyed off `key` rather than stored here so there's one source of truth for
// the artwork.
export const MEASUREMENTS = [
  { key: 'weight', label: 'Weight', unit: 'kg', lowerIsProgress: true },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm', lowerIsProgress: true },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
]

export const MEASUREMENT_KEYS = MEASUREMENTS.map((m) => m.key)

const byKey = new Map(MEASUREMENTS.map((m) => [m.key, m]))

export function metaFor(key) {
  return byKey.get(key)
}

export function unitFor(key) {
  return byKey.get(key)?.unit ?? ''
}

export function labelFor(key) {
  return byKey.get(key)?.label ?? key
}
