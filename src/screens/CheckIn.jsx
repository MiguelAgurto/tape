import { useEffect, useRef, useState } from 'react'
import { createCheckin, myCheckinsToday, uploadPhoto } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { compressImage } from '../lib/compress'
import { ACTIVITIES, activityFor } from '../lib/activities'
import { todayISO } from '../lib/day'

// The daily ritual. One tap is a complete check-in; everything else is
// optional, because a flow that takes thirty seconds is a flow nobody does on
// a Tuesday night.
export default function CheckIn() {
  const { user, logout } = useAuth()
  const fileRef = useRef(null)
  const date = todayISO()

  const [activity, setActivity] = useState(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  // null while loading, then the rows already filed today.
  const [already, setAlready] = useState(null)

  useEffect(() => {
    let cancelled = false
    myCheckinsToday(user.id, date)
      .then((rows) => {
        if (!cancelled) setAlready(rows)
      })
      .catch((err) => {
        // Not knowing is survivable — worst case you log a second session.
        console.error('Could not check today:', err)
        if (!cancelled) setAlready([])
      })
    return () => {
      cancelled = true
    }
  }, [user.id, date])

  function pickFile(e) {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setPreviewFailed(false)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return f ? URL.createObjectURL(f) : null
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!activity || saving) return
    setError('')
    setSaving(true)
    try {
      // Photo first so its URL lands on the row in a single write. Compression
      // falls back to the original on failure — never block on a format we
      // can't decode.
      let photoUrl = null
      let photoId = null
      if (file) {
        const { blob, ext } = await compressImage(file)
        const up = await uploadPhoto(blob, `${Date.now()}.${ext}`)
        photoUrl = up.url
        photoId = up.fileId
      }

      const row = await createCheckin({
        userId: user.id,
        date,
        activity,
        note: note.trim(),
        photoUrl,
        photoId,
      })
      setDone(row)
      setAlready((prev) => [...(prev ?? []), row])
    } catch (err) {
      console.error(err)
      setError("Couldn't save that check-in. Try again.")
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setActivity(null)
    setNote('')
    setFile(null)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setPreviewFailed(false)
    setDone(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (done) return <CheckedIn row={done} count={already?.length ?? 1} onAgain={reset} />

  return (
    <div className="page">
      <h1 className="page-title">
        Today
        <button className="chip" onClick={logout} style={{ marginLeft: 'auto', fontSize: 13 }}>
          <span
            className="avatar"
            style={{ '--user': user.color, width: 20, height: 20, fontSize: 10 }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          {user.name}
        </button>
      </h1>

      {already && already.length > 0 && (
        <div className="card">
          <p className="section-label">Already in today</p>
          <div className="row">
            {already.map((r) => (
              <span className="chip" key={r.$id}>
                <span aria-hidden="true">{activityFor(r.activity).emoji}</span>
                {activityFor(r.activity).label}
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="stack">
            <div>
              <p className="section-label">
                {already?.length ? 'Another session?' : 'What did you do?'}
              </p>
              <div className="row">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={`chip activity-chip${activity === a.key ? ' active' : ''}`}
                    aria-pressed={activity === a.key}
                    onClick={() => setActivity(a.key)}
                  >
                    <span aria-hidden="true">{a.emoji}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="checkin-note">Note</label>
              <textarea
                id="checkin-note"
                placeholder="Optional — how'd it go?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="checkin-photo">Photo</label>
              {/* No `capture`: it would force the camera on iOS and block
                  picking a shot you already took. */}
              <input
                id="checkin-photo"
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={pickFile}
              />
              {preview && !previewFailed && (
                <img
                  src={preview}
                  alt="preview"
                  onError={() => setPreviewFailed(true)}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    borderRadius: 10,
                    maxHeight: 300,
                    objectFit: 'cover',
                  }}
                />
              )}
              {file && previewFailed && (
                <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                  {file.name} — ready to upload (no preview for this format)
                </p>
              )}
            </div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 20 }}>
          <button type="submit" disabled={saving || !activity}>
            {saving ? 'Saving…' : 'Check in'}
          </button>
          {!activity && (
            <p
              className="muted"
              style={{ textAlign: 'center', fontSize: 13, margin: '12px 0 0' }}
            >
              Pick what you did — that's the whole check-in.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

function CheckedIn({ row, count, onAgain }) {
  const meta = activityFor(row.activity)
  return (
    <div className="page">
      <h1 className="page-title">Checked in</h1>

      <div className="card">
        <div className="empty" style={{ padding: '20px 8px' }}>
          <span className="empty-emoji">{meta.emoji}</span>
          <div className="empty-title">{meta.label} logged</div>
          <p>
            {count > 1
              ? `That's ${count} sessions today. The crew can see it.`
              : "That's you on the board. The crew can see it."}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="ghost" onClick={onAgain}>
          Log another session
        </button>
      </div>
    </div>
  )
}
