import { useRef, useState } from 'react'
import { supabase, PHOTO_BUCKET } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { compressImage } from '../lib/compress'
import { MEASUREMENTS, unitFor, labelFor } from '../lib/measurements'

function todayISO() {
  // Local date (not UTC) so "today" matches the user's clock.
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export default function LogEntry() {
  const { user, logout } = useAuth()
  const fileRef = useRef(null)

  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState({})
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { deltas, note }

  function setField(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Numeric fields → numbers (blank stays null).
      const measurements = {}
      for (const m of MEASUREMENTS) {
        const raw = values[m.key]
        measurements[m.key] = raw === '' || raw == null ? null : Number(raw)
      }

      // Grab the previous entry BEFORE inserting, to compute deltas.
      const { data: prevRows } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
      const prev = prevRows?.[0] ?? null

      const { data: inserted, error: insErr } = await supabase
        .from('entries')
        .insert({ user_id: user.id, date, note: note || null, ...measurements })
        .select()
        .single()
      if (insErr) throw insErr

      // Photo (optional): compress client-side, fall back to original on failure.
      if (file) {
        const { blob, ext } = await compressImage(file)
        const path = `${user.id}/${inserted.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
        if (upErr) throw upErr
        const { error: phErr } = await supabase
          .from('photos')
          .insert({ entry_id: inserted.id, storage_path: path })
        if (phErr) throw phErr
      }

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
    setPreview(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (result) {
    return (
      <div className="page">
        <h1 className="page-title">Saved ✅</h1>
        <div className="card">
          {result.deltas.length === 0 ? (
            <p className="muted">First entry logged — no previous entry to compare yet.</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>Since your last entry</p>
              {result.deltas.map((d) => (
                <DeltaRow key={d.key} d={d} />
              ))}
            </>
          )}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={reset}>Log another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="page-title">Log entry</h1>
        <button className="chip" onClick={logout} style={{ width: 'auto' }}>
          {user.name} · switch
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="grid-2">
            {MEASUREMENTS.map((m) => (
              <div className="field" key={m.key}>
                <label>{m.label} ({m.unit})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  placeholder="—"
                  value={values[m.key] ?? ''}
                  onChange={(e) => setField(m.key, e.target.value.replace(',', '.'))}
                />
              </div>
            ))}
          </div>

          <div className="field">
            <label>Photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={pickFile}
            />
            {preview && (
              <img
                src={preview}
                alt="preview"
                style={{ marginTop: 10, width: '100%', borderRadius: 10, maxHeight: 280, objectFit: 'cover' }}
              />
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Note</label>
            <textarea
              placeholder="How'd it go?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </form>
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
    const diff = Number(now) - Number(before)
    out.push({ key: m.key, diff })
  }
  return out
}

function DeltaRow({ d }) {
  const meta = MEASUREMENTS.find((m) => m.key === d.key)
  const unit = unitFor(d.key)
  const rounded = Math.round(d.diff * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  // "Progress" direction differs per measure (lower weight/waist is progress).
  const isProgress = meta?.lowerIsProgress ? rounded < 0 : rounded > 0
  const cls = rounded === 0 ? '' : isProgress ? 'down' : 'up'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
      <span>{labelFor(d.key)}</span>
      <span className={`delta ${cls}`}>
        {rounded === 0 ? 'no change' : `${sign}${rounded}${unit}`}
      </span>
    </div>
  )
}
