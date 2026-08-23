import { useEffect, useState } from 'react'
import { supabase, photoUrl } from '../lib/supabase'
import { MEASUREMENTS, unitFor } from '../lib/measurements'

export default function CrewFeed() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    supabase
      .from('entries')
      .select('*, users(name, color), photos(storage_path)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setEntries(data ?? []))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Crew</h1>
      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="muted">No entries yet. Be the first — hit Log.</p>
      ) : (
        entries.map((e) => <FeedItem key={e.id} entry={e} />)
      )}
    </div>
  )
}

function FeedItem({ entry }) {
  const u = entry.users || {}
  const thumb = entry.photos?.[0]?.storage_path
  const filled = MEASUREMENTS.filter((m) => entry[m.key] != null)

  return (
    <div className="card">
      <div className="feed-item">
        {thumb ? (
          <img className="thumb" src={photoUrl(thumb)} alt="" loading="lazy" />
        ) : (
          <span className="avatar" style={{ background: u.color || '#4f8cff', width: 56, height: 56, fontSize: 20 }}>
            {(u.name || '?').charAt(0)}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot" style={{ background: u.color || '#4f8cff' }} />
            <strong>{u.name || 'Someone'}</strong>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
              {fmtDate(entry.date)}
            </span>
          </div>
          {filled.length > 0 && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {filled
                .map((m) => `${m.label} ${entry[m.key]}${unitFor(m.key)}`)
                .join(' · ')}
            </div>
          )}
          {entry.note && <div style={{ marginTop: 6, fontSize: 14 }}>{entry.note}</div>}
        </div>
      </div>
    </div>
  )
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
