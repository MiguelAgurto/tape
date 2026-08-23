import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function NamePinPicker() {
  const { login } = useAuth()
  const [users, setUsers] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, color')
      .order('name')
      .then(({ data, error }) => {
        if (error) setLoadError(true)
        else setUsers(data ?? [])
      })
  }, [])

  // Attempt login once 4 digits are entered.
  useEffect(() => {
    if (pin.length !== 4 || !selected) return
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
    setPin((p) => (p.length < 4 ? p + d : p))
  }

  if (loadError) {
    return (
      <div className="center-screen">
        <h1>Tape</h1>
        <p className="error">
          Couldn't load the crew. Check the Supabase config in <code>.env</code>.
        </p>
      </div>
    )
  }

  if (!users) {
    return (
      <div className="center-screen">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  // Step 1 — pick your name.
  if (!selected) {
    return (
      <div className="center-screen">
        <h1>Tape</h1>
        <p className="muted">Who's this?</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {users.map((u) => (
            <button
              key={u.id}
              className="ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-start' }}
              onClick={() => setSelected(u)}
            >
              <span className="dot" style={{ background: u.color }} />
              {u.name}
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
        className="ghost"
        style={{ alignSelf: 'flex-start', width: 'auto', padding: '8px 12px' }}
        onClick={() => {
          setSelected(null)
          setPin('')
          setError('')
        }}
      >
        ← {selected.name}
      </button>
      <p className="muted" style={{ textAlign: 'center' }}>Enter your PIN</p>
      <div className="pin-display">{'•'.repeat(pin.length).padEnd(4, '·')}</div>
      {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => press(String(d))}>{d}</button>
        ))}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
      </div>
      {checking && <p className="muted" style={{ textAlign: 'center' }}>Checking…</p>}
    </div>
  )
}
