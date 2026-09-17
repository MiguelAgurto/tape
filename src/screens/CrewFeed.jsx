import { useCallback, useEffect, useMemo, useState } from 'react'
import { listFeed } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { useCrewRealtime } from '../lib/realtime'
import FeedItem from '../components/FeedItem'
import TodayStrip from '../components/TodayStrip'

export default function CrewFeed() {
  const { user } = useAuth()
  const [feed, setFeed] = useState(null)
  const [failed, setFailed] = useState(false)
  const [hasNew, setHasNew] = useState(false)

  const load = useCallback(() => {
    return listFeed()
      .then((res) => {
        setFeed(res)
        setFailed(false)
        setHasNew(false)
      })
      .catch((err) => {
        console.error('Could not load the feed:', err)
        setFailed(true)
        setFeed({ posts: [], users: [] })
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Patch one post in place. Accepts either a partial object or a function of
  // the current post, so optimistic updates can't clobber a racing one.
  const patchPost = useCallback((targetKey, patch) => {
    setFeed((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.targetKey === targetKey
            ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) }
            : p,
        ),
      }
    })
  }, [])

  // Drop a post from the list once it's gone from the backend. The realtime
  // delete event will arrive too, but it only raises the refresh pill, so the
  // card has to come out here or it lingers until you tap it.
  const removePost = useCallback((targetKey) => {
    setFeed((prev) =>
      prev ? { ...prev, posts: prev.posts.filter((p) => p.targetKey !== targetKey) } : prev,
    )
  }, [])

  useCrewRealtime(
    useCallback(({ table, action, row }) => {
      // Reactions and comments are self-contained: the payload carries its own
      // targetKey, so it can be applied straight into the post it belongs to.
      // Keying by $id keeps it idempotent — your own writes echo back here too.
      if (table === 'reactions' || table === 'comments') {
        const field = table === 'reactions' ? 'reactions' : 'comments'
        patchPost(row.targetKey, (p) => {
          const without = p[field].filter((x) => x.$id !== row.$id)
          return { [field]: action === 'delete' ? without : [...without, row] }
        })
        return
      }

      // A new post is a different matter: the payload arrives with no author
      // stitched in and may belong outside the current window. Offer a refresh
      // rather than guessing where it goes.
      setHasNew(true)
    }, [patchPost]),
  )

  const usersById = useMemo(
    () => new Map((feed?.users ?? []).map((u) => [u.$id, u])),
    [feed?.users],
  )

  return (
    <div className="page">
      <h1 className="page-title">Crew</h1>

      {feed === null ? (
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
      ) : (
        <>
          {feed.users.length > 0 && (
            <TodayStrip posts={feed.posts} users={feed.users} me={user} />
          )}

          {hasNew && (
            <button type="button" className="new-pill" onClick={load}>
              New activity — tap to refresh
            </button>
          )}

          {feed.posts.length === 0 ? (
            <div className="empty">
              <span className="empty-emoji">🏁</span>
              <div className="empty-title">Nothing logged yet</div>
              <p>Be the first on the board — head to Today.</p>
            </div>
          ) : (
            feed.posts.map((p) => (
              <FeedItem
                key={p.targetKey}
                post={p}
                me={user}
                usersById={usersById}
                onPatch={(patch) => patchPost(p.targetKey, patch)}
                onDelete={() => removePost(p.targetKey)}
              />
            ))
          )}
        </>
      )}
    </div>
  )
}
