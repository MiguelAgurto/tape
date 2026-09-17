import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addComment, deleteComment } from '../lib/db'

// Collapsed to a count until tapped. At daily cadence the feed is mostly
// skimmed, and an always-open thread on every card would bury the posts.
export default function CommentThread({ post, me, usersById, onPatch }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const count = post.comments.length

  async function send(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      const row = await addComment({ post, userId: me.id, body })
      onPatch((current) => ({ comments: [...current.comments, row] }))
      setDraft('')
    } catch (err) {
      console.error('Comment failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(comment) {
    onPatch((current) => ({ comments: current.comments.filter((c) => c.$id !== comment.$id) }))
    try {
      await deleteComment(comment.$id)
    } catch (err) {
      console.error('Could not delete comment:', err)
      onPatch((current) => ({ comments: [...current.comments, comment] }))
    }
  }

  if (!open) {
    return (
      <button type="button" className="comment-toggle" onClick={() => setOpen(true)}>
        {count === 0 ? 'Say something' : count === 1 ? '1 reply' : `${count} replies`}
      </button>
    )
  }

  return (
    <div className="comment-list">
      {post.comments.map((c) => {
        const author = usersById.get(c.userId)
        return (
          <div className="comment" key={c.$id} style={{ '--user': author?.color || 'var(--accent)' }}>
            <Link to={`/crew/${c.userId}`} className="author-link">
              <span className="avatar">{(author?.name || '?').charAt(0).toUpperCase()}</span>
            </Link>
            <div className="comment-body">
              <Link to={`/crew/${c.userId}`} className="comment-name">
                {author?.name || 'Someone'}
              </Link>
              <span className="comment-text">{c.body}</span>
            </div>
            {/* Ownership is a UI convention here, not a guarantee — the table
                is open to anyone. It stops honest mistakes, nothing more. */}
            {c.userId === me.id && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Delete comment"
                onClick={() => remove(c)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      <form className="comment-form" onSubmit={send}>
        <input
          type="text"
          placeholder="Say something…"
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Write a reply"
        />
        <button type="submit" className="chip" disabled={submitting || !draft.trim()}>
          {submitting ? '…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
