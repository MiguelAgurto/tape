import { useEffect, useState } from 'react'
import { listUsers } from '../lib/db'
import { useAuth } from '../context/AuthContext'

const PIN_LENGTH = 4

export default function NamePinPicker() {
  const { login } = useAuth()
  const [users, setUsers] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => {
        console.error('Could not load the crew:', err)
        setLoadError(true)
      })
  }, [])

  // Attempt login once the PIN is complete.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !selected) return
    let cancelled = false
    setChecking(true)
    setError('')
    login(selected, pin).then((ok) => {
      if (cancelled) return
      setChecking(false)
      if (!ok) {
        setError('Wrong PIN, try again')
        setPin('')
      }
    })
    return () => {
      cancelled = true
    }
  }, [pin, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  function press(d) {
    if (checking) return
    setError('')
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p))
  }

  if (loadError) {
    return (
      <div className="center-screen">
        <Brand />
        <p className="error">
          Couldn't load the crew. Check the Appwrite config in <code>.env</code>.
        </p>
      </div>
    )
  }

  if (!users) {
    return (
      <div className="center-screen">
        <Brand />
        <div className="skeleton" style={{ height: 54 }} />
        <div className="skeleton" style={{ height: 54 }} />
      </div>
    )
  }

  // No crew seeded yet — the app is wired up but the users table is empty.
  if (users.length === 0) {
    return (
      <div className="center-screen">
        <Brand />
        <div className="card">
          <div className="empty" style={{ padding: 0 }}>
            <span className="empty-emoji">👥</span>
            <div className="empty-title">No crew yet</div>
            <p style={{ marginBottom: 14 }}>Seed the roster with:</p>
            <code style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--accent)' }}>
              node scripts/seed-users.mjs "Name:#c9f24d:1234"
            </code>
          </div>
        </div>
      </div>
    )
  }

  // Step 1 — pick your name.
  if (!selected) {
    return (
      <div className="center-screen">
        <Brand />
        <div style={{ display: 'grid', gap: 10 }}>
          {users.map((u) => (
            <button key={u.$id} className="ghost person" onClick={() => setSelected(u)}>
              <span className="avatar" style={{ '--user': u.color }}>
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span className="person-name">{u.name}</span>
              <span className="person-go">→</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 2 — enter PIN.
  return (
    <div className="center-screen">
      <button
        className="chip"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          setSelected(null)
          setPin('')
          setError('')
        }}
      >
        ← Back
      </button>

      <div style={{ textAlign: 'center' }}>
        <span className="avatar avatar-lg" style={{ '--user': selected.color }}>
          {selected.name.charAt(0).toUpperCase()}
        </span>
        <div className="person-name" style={{ marginTop: 14 }}>{selected.name}</div>
        <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
          {checking ? 'Checking…' : error ? error : `Enter your ${PIN_LENGTH}-digit PIN`}
        </p>
      </div>

      <div className={`pin-display ${error ? 'shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`pin-dot ${error ? 'bad' : i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => press(String(d))}>
            {d}
          </button>
        ))}
        <button className="blank" tabIndex={-1} aria-hidden="true" />
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))}>
          ⌫
        </button>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <h1 className="brand-name">
        tape<span className="dot-accent">.</span>
      </h1>
      <p className="brand-tag">Measure. Log. Compare.</p>
    </div>
  )
}
