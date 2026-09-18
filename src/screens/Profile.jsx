import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listProfile, attachSocial } from '../lib/db'
import { readCache, writeCache } from '../lib/cache'
import { useAuth } from '../context/AuthContext'
import { activityFor } from '../lib/activities'
import { daysAgoISO, fmtDay } from '../lib/day'
// recharts is ~2/3 of the bundle and only a profile draws a chart, so it is
// split out and fetched while the rest of the page is already on screen.
const MeasurementChart = lazy(() => import('../components/MeasurementChart'))
import PhotoViewer from '../components/PhotoViewer'
import PhotoCompare from '../components/PhotoCompare'
import FeedItem from '../components/FeedItem'

const STRIP_DAYS = 14

// Serves two routes: /crew/:userId for a brother, and /me for yourself. The
// only differences are the way back (a tab needs none) and the account section
// at the bottom, which is the one thing a profile of someone else must not show.
export default function Profile() {
  const { userId: param } = useParams()
  const { user: me, logout } = useAuth()
  const navigate = useNavigate()

  // No param means /me — the tab.
  const userId = param ?? me.id
  const asTab = !param

  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [viewing, setViewing] = useState(null)
  // Selection mode for comparing. `picked` holds targetKeys, oldest pick first.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState([])
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `profile.${userId}`
    // Paint last time's profile straight away; the fetch below replaces it.
    setData(readCache(cacheKey))
    setFailed(false)
    setSelecting(false)
    setPicked([])
    listProfile(userId)
      .then((res) => {
        if (cancelled) return null
        // Paint everything above the recent cards now; the reactions and
        // replies arrive a round trip later and patch themselves in.
        setData(res)
        return attachSocial(res.recent)
      })
      .then((recent) => {
        if (cancelled || !recent) return
        setData((d) => {
          if (!d) return d
          const next = { ...d, recent }
          // Cache only once the social wave is in, so a return visit never
          // paints cards with their reactions missing.
          writeCache(cacheKey, next)
          return next
        })
      })
      .catch((err) => {
        console.error('Could not load that profile:', err)
        // Only surface the failure if there is nothing cached to show.
        if (!cancelled && !readCache(cacheKey)) setFailed(true)
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
        {!asTab && <BackLink />}
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
        {!asTab && <BackLink />}
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

  // Two at a time. Picking a third drops the older selection rather than
  // refusing the tap — being told "deselect one first" is a worse answer than
  // just doing the obvious thing.
  function togglePick(key) {
    setPicked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-2),
    )
  }

  const pickedPhotos = picked
    .map((k) => photos.find((p) => p.targetKey === k))
    .filter(Boolean)

  return (
    <div className="page" style={{ '--user': color }}>
      {!asTab && <BackLink />}

      <header className="profile-head">
        <span className="avatar profile-avatar">{(user.name || '?').charAt(0).toUpperCase()}</span>
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
        <div className="section-head">
          <p className="section-label">
            Photos{photos.length > 0 && ` · ${photos.length}`}
          </p>
          {photos.length >= 2 && (
            <button
              type="button"
              className="chip section-action"
              onClick={() => {
                setSelecting((on) => !on)
                setPicked([])
              }}
            >
              {selecting ? 'Cancel' : 'Compare'}
            </button>
          )}
        </div>
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
            {photos.map((p) => {
              const at = picked.indexOf(p.targetKey)
              return (
                <button
                  key={p.targetKey}
                  type="button"
                  className={`photo-cell${selecting ? ' selecting' : ''}${at > -1 ? ' picked' : ''}`}
                  aria-label={
                    selecting
                      ? `${at > -1 ? 'Deselect' : 'Select'} photo from ${fmtDay(p.date)}`
                      : `Photo from ${fmtDay(p.date)}`
                  }
                  aria-pressed={selecting ? at > -1 : undefined}
                  onClick={() => (selecting ? togglePick(p.targetKey) : setViewing(p))}
                >
                  <img src={p.photoUrl} alt="" loading="lazy" />
                  <span className="photo-cell-date">{fmtDay(p.date)}</span>
                  {selecting && <span className="pick-badge">{at > -1 ? at + 1 : ''}</span>}
                </button>
              )
            })}
          </div>
        )}

        {selecting && (
          <div className="compare-bar">
            <span className="confirm-text">
              {picked.length === 0
                ? 'Pick two photos.'
                : picked.length === 1
                  ? 'Pick one more.'
                  : 'Ready.'}
            </span>
            <button
              type="button"
              className="chip active"
              disabled={picked.length !== 2}
              onClick={() => setComparing(true)}
            >
              Compare
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: 26 }}>
        <p className="section-label">{isMe ? 'The tape' : 'Measurements'}</p>
        <Suspense fallback={<div className="skeleton sk-card" style={{ height: 240 }} />}>
          <MeasurementChart entries={entries} color={color} compact />
        </Suspense>
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

      {isMe && (
        <section style={{ marginTop: 26 }}>
          <p className="section-label">Account</p>
          <div className="card">
            <div className="account-row">
              <span>
                Signed in as <strong>{user.name}</strong>
              </span>
              <button type="button" className="chip" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </section>
      )}

      {comparing && pickedPhotos.length === 2 && (
        <PhotoCompare
          a={pickedPhotos[0]}
          b={pickedPhotos[1]}
          onClose={() => setComparing(false)}
        />
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
