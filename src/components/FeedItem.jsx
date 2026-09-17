import { useState } from 'react'
import { MEASUREMENTS, unitFor, labelFor } from '../lib/measurements'
import { activityFor } from '../lib/activities'
import { fmtDay } from '../lib/day'
import Icon from '../components/Icon'
import ReactionBar from './ReactionBar'
import CommentThread from './CommentThread'
import PhotoViewer from './PhotoViewer'

// One card in the crew feed. The shell — author, date, photo, note, reactions,
// replies — is identical for both kinds of post; only the body differs.
export default function FeedItem({ post, me, usersById, onPatch }) {
  // The author can be null if a user row was deleted while their posts remain.
  const u = post.user || {}
  const color = u.color || 'var(--accent)'
  const [viewing, setViewing] = useState(false)

  return (
    <article className="feed-card" style={{ '--user': color }}>
      <header className="feed-head">
        <span className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</span>
        <span className="feed-name">{u.name || 'Someone'}</span>
        <time className="feed-date">{fmtDay(post.date)}</time>
      </header>

      <div className="feed-body">
        {post.photoUrl && (
          <button
            type="button"
            className="thumb-btn"
            aria-label={`View ${u.name || 'this'} photo full size`}
            onClick={() => setViewing(true)}
          >
            <img className="thumb" src={post.photoUrl} alt="" loading="lazy" />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {post.kind === 'checkin' ? <CheckinBody post={post} /> : <EntryBody post={post} />}
        </div>
      </div>

      {post.note && <div className="feed-note">{post.note}</div>}

      {viewing && post.photoUrl && (
        <PhotoViewer
          src={post.photoUrl}
          alt={`${u.name || 'Crew'} — ${post.date}`}
          onClose={() => setViewing(false)}
        />
      )}

      <div className="social-bar">
        <ReactionBar post={post} me={me} onPatch={onPatch} />
        <CommentThread post={post} me={me} usersById={usersById} onPatch={onPatch} />
      </div>
    </article>
  )
}

// A check-in reads from a single tapped chip, so the activity itself is the
// headline — there's no number to lead with and there doesn't need to be.
function CheckinBody({ post }) {
  const meta = activityFor(post.payload?.activity)
  return (
    <>
      <div className="stat stat-lg hero-value">
        <span className="activity-emoji" aria-hidden="true">
          {meta.emoji}
        </span>
        {meta.label}
      </div>
      <div className="hero-label">Checked in</div>
    </>
  )
}

// The original measurement rendering, moved wholesale out of CrewFeed: the
// first recorded measurement becomes the headline figure, the rest are pills.
function EntryBody({ post }) {
  const filled = MEASUREMENTS.filter((m) => post.payload?.[m.key] != null)
  const [hero, ...rest] = filled

  if (!hero) {
    return !post.note ? (
      <div className="muted" style={{ fontSize: 14 }}>
        Photo only
      </div>
    ) : null
  }

  return (
    <>
      <div className="stat stat-lg hero-value">
        {post.payload[hero.key]}
        <span className="stat-unit">{unitFor(hero.key)}</span>
      </div>
      <div className="hero-label">{labelFor(hero.key)}</div>

      {rest.length > 0 && (
        <div className="stat-pills">
          {rest.map((m) => (
            <span className="stat-pill" key={m.key}>
              <Icon name={m.key} size={17} className="measure-icon" />
              <span className="pv">{post.payload[m.key]}</span>
              {unitFor(m.key)}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
