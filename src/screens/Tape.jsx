import { useEffect, useState } from 'react'
import { listEntriesForUser } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import MeasurementChart from '../components/MeasurementChart'

// Your own measurement history. The chart itself lives in MeasurementChart so
// a crew profile can draw the same thing for someone else.
export default function Tape() {
  const { user } = useAuth()
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    listEntriesForUser(user.id)
      .then(setEntries)
      .catch((err) => {
        console.error('Could not load your history:', err)
        setEntries([])
      })
  }, [user.id])

  return (
    <div className="page">
      <h1 className="page-title">The tape</h1>
      <MeasurementChart entries={entries} color={user.color || '#c9f24d'} />
    </div>
  )
}
