import { useEffect, useRef, useState } from 'react'
import { createEntry, latestEntryForUser, uploadPhoto } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { compressImage } from '../lib/compress'
import { loadFields, saveFields } from '../lib/prefs'
import {
  MEASUREMENTS,
  MEASUREMENT_KEYS,
  metaFor,
  unitFor,
  labelFor,
} from '../lib/measurements'
import Icon from '../components/Icon'
import { todayISO } from '../lib/day'

export default function LogEntry() {
  const { user, logout } = useAuth()
  const fileRef = useRef(null)

  const [date, setDate] = useState(todayISO())
  // Which measurements are on the form. Starts from what this user logged last
  // time rather than showing all six at once.
  const [fields, setFields] = useState(() => loadFields(user.id))
  const [values, setValues] = useState({})
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    saveFields(user.id, fields)
  }, [user.id, fields])

  function toggleField(key) {
    setFields((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : // Keep the canonical order regardless of the order chips were tapped,
          // so the form doesn't shuffle (Thigh above Chest, etc).
          MEASUREMENT_KEYS.filter((k) => k === key || prev.includes(k)),
    )
    // Clear any value belonging to a field being removed, so a hidden input
    // can't silently save.
    setValues((prev) => {
      if (!fields.includes(key)) return prev
      const { [key]: _dropped, ...rest } = prev
      return rest
    })
  }

  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setPreviewFailed(false)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return f ? URL.createObjectURL(f) : null
    })
  }

  const hasSomething =
    fields.some((k) => values[k]?.toString().trim()) || note.trim() || file

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Only the fields currently on the form are considered.
      const measurements = {}
      for (const key of fields) measurements[key] = values[key]

      // Grab the previous entry BEFORE inserting, so deltas compare against it.
      const prev = await latestEntryForUser(user.id)

      // Photo (optional) goes up first, so its URL lands on the entry in one
      // write. Compression falls back to the original file on failure — an
      // upload is never blocked by a format we can't decode.
      let photoUrl = null
      if (file) {
        const { blob, ext } = await compressImage(file)
        const { url } = await uploadPhoto(blob, `${Date.now()}.${ext}`)
        photoUrl = url
      }

      const inserted = await createEntry({ userId: user.id, date, note, photoUrl, measurements })
      setResult({ deltas: computeDeltas(prev, inserted) })
    } catch (err) {
      console.error(err)
      setError('Something went wrong saving your entry. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setDate(todayISO())
    setValues({})
    setNote('')
    setFile(null)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setPreviewFailed(false)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (result) return <SavedScreen deltas={result.deltas} onAgain={reset} />

  const unused = MEASUREMENTS.filter((m) => !fields.includes(m.key))

  return (
    <div className="page">
      <h1 className="page-title">
        Log
        <button
          className="chip"
          onClick={logout}
          style={{ marginLeft: 'auto', fontSize: 13 }}
        >
          <span className="avatar" style={{ '--user': user.color, width: 20, height: 20, fontSize: 10 }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
          {user.name}
        </button>
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Card one: what you measured. */}
        <div className="card">
          <div className="stack">
            <div>
              <label htmlFor="entry-date">Date</label>
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {fields.length > 0 && (
              <div>
                <p className="section-label">Measurements</p>
                {fields.map((key) => (
                  <div className="measure-row" key={key}>
                    <div className="measure-id">
                      <Icon name={key} className="measure-icon" />
                      <span className="measure-name">{labelFor(key)}</span>
                    </div>
                    <div className="measure-input">
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        placeholder="—"
                        aria-label={labelFor(key)}
                        value={values[key] ?? ''}
                        onChange={(e) => setField(key, e.target.value.replace(',', '.'))}
                      />
                      <span className="measure-unit">{unitFor(key)}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${labelFor(key)}`}
                        onClick={() => toggleField(key)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unused.length > 0 && (
              <div>
                <p className="section-label">
                  {fields.length === 0 ? 'What are you logging?' : 'Add another'}
                </p>
                <div className="row">
                  {unused.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className="chip"
                      onClick={() => toggleField(m.key)}
                    >
                      <span className="plus">+</span>
                      <Icon name={m.key} size={17} className="measure-icon" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card two: everything else. */}
        <div className="card">
          <div className="stack">
            <div>
              <label htmlFor="entry-photo">Photo</label>
              {/* No `capture` attribute: it would force the camera on iOS and
                  block picking an existing shot. HEIC/HEIF are named explicitly
                  because some Android pickers hide them under a bare image/*. */}
              <input
                id="entry-photo"
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

            <div>
              <label htmlFor="entry-note">Note</label>
              <textarea
                id="entry-note"
                placeholder="How'd it go?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 20 }}>
          <button type="submit" disabled={saving || !hasSomething}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
          {!hasSomething && (
            <p
              className="muted"
              style={{ textAlign: 'center', fontSize: 13, margin: '12px 0 0' }}
            >
              Add a measurement, a photo, or a note to save.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

function SavedScreen({ deltas, onAgain }) {
  return (
    <div className="page">
      <h1 className="page-title">Saved</h1>

      {deltas.length === 0 ? (
        <div className="card">
          <div className="empty" style={{ padding: '20px 8px' }}>
            <span className="empty-emoji">🌱</span>
            <div className="empty-title">You're on the board</div>
            <p>Nothing to compare yet — your next entry will show the change.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="section-label">Since your last entry</p>
          {deltas.map((d) => (
            <DeltaRow key={d.key} d={d} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="ghost" onClick={onAgain}>
          Log another
        </button>
      </div>
    </div>
  )
}

function computeDeltas(prev, current) {
  if (!prev) return []
  const out = []
  for (const m of MEASUREMENTS) {
    const now = current[m.key]
    const before = prev[m.key]
    if (now == null || before == null) continue
    out.push({ key: m.key, diff: Number(now) - Number(before) })
  }
  return out
}

function DeltaRow({ d }) {
  const meta = metaFor(d.key)
  const rounded = Math.round(d.diff * 10) / 10
  // "Progress" direction differs per measure (lower weight/waist is progress).
  const isProgress = meta?.lowerIsProgress ? rounded < 0 : rounded > 0
  const cls = rounded === 0 ? 'flat' : isProgress ? 'good' : 'bad'
  const sign = rounded > 0 ? '+' : ''

  return (
    <div className="delta-row">
      <Icon name={d.key} className="measure-icon" />
      <span className="measure-name">{labelFor(d.key)}</span>
      <span className={`delta-value ${cls}`}>
        {rounded === 0 ? 'no change' : `${sign}${rounded} ${unitFor(d.key)}`}
      </span>
    </div>
  )
}
