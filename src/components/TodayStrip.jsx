import { Link } from 'react-router-dom'
import { activityFor } from '../lib/activities'
import { todayISO } from '../lib/day'

// Who has shown up today. This is the accountability surface — the rest of the
// app records what happened, this is the bit that asks a question.
//
// Derived entirely from the posts the feed already fetched: today's check-ins
// are the newest rows in the window, so they're always present. No extra query.
export default function TodayStrip({ posts, users, me }) {
  const today = todayISO()
  const byUser = new Map()
  for (const p of posts) {
    if (p.kind !== 'checkin' || p.date !== today) continue
    if (!byUser.has(p.userId)) byUser.set(p.userId, p)
  }

  const inCount = byUser.size
  const meIn = byUser.has(me.id)

  return (
    <div className="card today-strip">
      <div className="row">
        {users.map((u) => {
          const post = byUser.get(u.$id)
          return (
            <Link
              to={`/crew/${u.$id}`}
              className={`today-person${post ? ' done' : ''}`}
              key={u.$id}
              style={{ '--user': u.color }}
            >
              <span className="avatar">{(u.name || '?').charAt(0).toUpperCase()}</span>
              {post && (
                <span className="today-badge" aria-hidden="true">
                  {activityFor(post.payload?.activity).emoji}
                </span>
              )}
              <span className="today-name">{u.name}</span>
            </Link>
          )
        })}
      </div>

      <p className="today-line muted">
        {meIn ? (
          `${inCount} of ${users.length} in today.`
        ) : inCount === 0 ? (
          <Link to="/today">Nobody's in yet. Be first →</Link>
        ) : (
          <Link to="/today">
            {inCount} of {users.length} in — you're the gap. Check in →
          </Link>
        )}
      </p>
    </div>
  )
}
