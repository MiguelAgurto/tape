// The measurement fields tracked in v1. Units are hardcoded (kg/cm) for now.
export const MEASUREMENTS = [
  { key: 'weight', label: 'Weight', unit: 'kg', lowerIsProgress: true },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm', lowerIsProgress: true },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' },
]

export const MEASUREMENT_KEYS = MEASUREMENTS.map((m) => m.key)

export function unitFor(key) {
  return MEASUREMENTS.find((m) => m.key === key)?.unit ?? ''
}

export function labelFor(key) {
  return MEASUREMENTS.find((m) => m.key === key)?.label ?? key
}
