import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listProfile } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { activityFor } from '../lib/activities'
import { daysAgoISO, fmtDay } from '../lib/day'
import MeasurementChart from '../components/MeasurementChart'
import PhotoViewer from '../components/PhotoViewer'
import FeedItem from '../components/FeedItem'

const STRIP_DAYS = 14

export default function Profile() {
  const { userId } = useParams()
  const { user: me } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    listProfile(userId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        console.error('Could not load that profile:', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const usersById = useMemo(
    () => new Map((data?.users ?? []).map((u) => [u.$id, u])),
    [data?.users],
  )

  if (failed || (data && !data.user)) {
    return (
      <div className="page">
        <BackLink />
        <div className="empty">
          <span className="empty-emoji">🤷</span>
          <div className="empty-title">No one here</div>
          <p>That crew member doesn't exist any more.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <BackLink />
        <div className="skeleton sk-card" style={{ height: 120 }} />
        <div className="skeleton sk-card" style={{ height: 200 }} />
      </div>
    )
  }

  const { user, posts, checkins, entries, photos, recent } = data
  const color = user.color || 'var(--accent)'
  const isMe = user.$id === me.id

  // Trained days in the last 30, and when they were last in.
  const since = daysAgoISO(29)
  const recentDays = new Set(checkins.filter((c) => c.date >= since).map((c) => c.date))
  const lastIn = checkins[0]?.date ?? null

  return (
    <div className="page" style={{ '--user': color }}>
      <BackLink />

      <header className="profile-head">
        <span className="avatar avatar-lg">{(user.name || '?').charAt(0).toUpperCase()}</span>
        <div>
          <h1 className="profile-name">{user.name}</h1>
          <p className="muted profile-sub">
            {recentDays.size > 0
              ? `${recentDays.size} day${recentDays.size === 1 ? '' : 's'} trained in the last 30`
              : 'No sessions in the last 30 days'}
            {lastIn && ` · last in ${fmtDay(lastIn).toLowerCase()}`}
          </p>
        </div>
      </header>

      <ConsistencyStrip checkins={checkins} />

      <section>
        <p className="section-label">
          Photos{photos.length > 0 && ` · ${photos.length}`}
        </p>
        {photos.length === 0 ? (
          <div className="empty" style={{ padding: '28px 12px' }}>
            <span className="empty-emoji">📷</span>
            <div className="empty-title">No photos yet</div>
            <p>
              {isMe
                ? 'Add one to a check-in or an entry and it lands here.'
                : `${user.name} hasn't posted a photo yet.`}
            </p>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((p) => (
              <button
                key={p.targetKey}
                type="button"
                className="photo-cell"
                aria-label={`Photo from ${fmtDay(p.date)}`}
                onClick={() => setViewing(p)}
              >
                <img src={p.photoUrl} alt="" loading="lazy" />
                <span className="photo-cell-date">{fmtDay(p.date)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        <p className="section-label">Measurements</p>
        <MeasurementChart entries={entries} color={color} compact />
      </section>

      {recent.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <p className="section-label">Recent</p>
          {recent.map((p) => (
            <FeedItem
              key={p.targetKey}
              post={p}
              me={me}
              usersById={usersById}
              onPatch={() => {}}
              onDelete={() => navigate(0)}
            />
          ))}
        </section>
      )}

      {posts.length === 0 && (
        <div className="empty">
          <span className="empty-emoji">🏁</span>
          <div className="empty-title">Nothing logged yet</div>
          <p>{isMe ? 'Your first check-in starts the record.' : `${user.name} hasn't started.`}</p>
        </div>
      )}

      {viewing && (
        <PhotoViewer
          src={viewing.photoUrl}
          alt={`${user.name} — ${viewing.date}`}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

// The last fortnight as dots: filled for a day they trained, hollow for a day
// they didn't. Reads as a pattern rather than a number, which is the point —
// three blanks in a row is obvious at a glance in a way "8 sessions" isn't.
function ConsistencyStrip({ checkins }) {
  const days = []
  const trained = new Set(checkins.map((c) => c.date))
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const date = daysAgoISO(i)
    days.push({ date, on: trained.has(date), activity: checkins.find((c) => c.date === date)?.activity })
  }

  return (
    <div className="card dot-strip-card">
      <p className="section-label">Last {STRIP_DAYS} days</p>
      <div className="dot-strip">
        {days.map((d) => (
          <span
            key={d.date}
            className={`dot${d.on ? ' on' : ''}`}
            title={`${d.date}${d.on ? ` — ${activityFor(d.activity).label}` : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/" className="back-link">
      ← Crew
    </Link>
  )
}
