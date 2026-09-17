import { useState } from 'react'
import { REACTION_EMOJI } from '../lib/reactions'
import { toggleReaction } from '../lib/db'

// The reaction row. Counts are derived from the rows the feed already loaded,
// so "who reacted" is available without another request.
//
// Reactions are themed with --user, which the feed card sets to the *post
// author's* colour — a card stays one colour no matter who piles on.
export default function ReactionBar({ post, me, onPatch }) {
  const [busy, setBusy] = useState(null)

  async function tap(emoji) {
    if (busy) return
    const existing = post.reactions.find((r) => r.userId === me.id && r.emoji === emoji)
    setBusy(emoji)

    // Optimistic: flip it now, reconcile with whatever the server returns.
    const optimistic = existing
      ? post.reactions.filter((r) => r.$id !== existing.$id)
      : [...post.reactions, { $id: `pending:${emoji}`, userId: me.id, emoji }]
    onPatch({ reactions: optimistic })

    try {
      const row = await toggleReaction({ existing, post, userId: me.id, emoji })
      onPatch((current) => ({
        reactions: row
          ? [...current.reactions.filter((r) => r.$id !== `pending:${emoji}`), row]
          : current.reactions.filter((r) => r.$id !== `pending:${emoji}`),
      }))
    } catch (err) {
      console.error('Reaction failed:', err)
      onPatch({ reactions: post.reactions })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="react-bar">
      {REACTION_EMOJI.map((emoji) => {
        const rows = post.reactions.filter((r) => r.emoji === emoji)
        const mine = rows.some((r) => r.userId === me.id)
        return (
          <button
            key={emoji}
            type="button"
            className={`react-btn${mine ? ' on' : ''}`}
            aria-pressed={mine}
            aria-label={`${emoji} ${rows.length}`}
            disabled={busy === emoji}
            onClick={() => tap(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {rows.length > 0 && <span className="react-count">{rows.length}</span>}
          </button>
        )
      })}
    </div>
  )
}
