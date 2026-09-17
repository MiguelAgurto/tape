// Date helpers shared by anything that needs "today".
//
// Dates are stored as YYYY-MM-DD strings (see db.js), which sort correctly as
// text. They're computed in local time, not UTC, so "today" matches the clock
// on the device — with the caveat that a crew member in another timezone can
// file a check-in that another device reads as yesterday. Fine for one family.

export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function isToday(date) {
  return date === todayISO()
}

// "Sep 17" for anything older than yesterday, friendlier words for the rest —
// at daily cadence most of the feed is the last 48 hours.
export function fmtDay(date) {
  if (!date) return ''
  if (isToday(date)) return 'Today'

  const d = new Date(date + 'T00:00:00')
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
