import { useEffect, useState } from 'react'
import { listFeed } from '../lib/db'
import { MEASUREMENTS, unitFor, labelFor } from '../lib/measurements'
import Icon from '../components/Icon'

export default function CrewFeed() {
  const [entries, setEntries] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    listFeed()
      .then(setEntries)
      .catch((err) => {
        console.error('Could not load the feed:', err)
        setFailed(true)
        setEntries([])
      })
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Crew</h1>

      {entries === null ? (
        <>
          <div className="skeleton sk-card" />
          <div className="skeleton sk-card" />
          <div className="skeleton sk-card" />
        </>
      ) : failed ? (
        <div className="empty">
          <span className="empty-emoji">📡</span>
          <div className="empty-title">Can't reach the backend</div>
          <p>Check your connection and give it another go.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">🏁</span>
          <div className="empty-title">Nothing logged yet</div>
          <p>Be the first on the board — head to Log.</p>
        </div>
      ) : (
        entries.map((e) => <FeedItem key={e.$id} entry={e} />)
      )}
    </div>
  )
}

function FeedItem({ entry }) {
  // listFeed attaches the author; it can be null if a user row was deleted
  // while their entries remain.
  const u = entry.user || {}
  const color = u.color || 'var(--accent)'
  const filled = MEASUREMENTS.filter((m) => entry[m.key] != null)
  // The first recorded measurement becomes the card's headline figure.
  const [hero, ...rest] = filled

  return (
    <article className="feed-card" style={{ '--user': color }}>
      <header className="feed-head">
        <span className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</span>
        <span className="feed-name">{u.name || 'Someone'}</span>
        <time className="feed-date">{fmtDate(entry.date)}</time>
      </header>

      <div className="feed-body">
        {entry.photoUrl && <img className="thumb" src={entry.photoUrl} alt="" loading="lazy" />}

        <div style={{ flex: 1, minWidth: 0 }}>
          {hero ? (
            <>
              <div className="stat stat-lg hero-value">
                {entry[hero.key]}
                <span className="stat-unit">{unitFor(hero.key)}</span>
              </div>
              <div className="hero-label">{labelFor(hero.key)}</div>

              {rest.length > 0 && (
                <div className="stat-pills">
                  {rest.map((m) => (
                    <span className="stat-pill" key={m.key}>
                      <Icon name={m.key} size={17} className="measure-icon" />
                      <span className="pv">{entry[m.key]}</span>
                      {unitFor(m.key)}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            !entry.note && <div className="muted" style={{ fontSize: 14 }}>Photo only</div>
          )}
        </div>
      </div>

      {entry.note && <div className="feed-note">{entry.note}</div>}
    </article>
  )
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
