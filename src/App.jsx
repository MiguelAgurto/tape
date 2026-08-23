import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import NamePinPicker from './screens/NamePinPicker'
import LogEntry from './screens/LogEntry'
import Tape from './screens/Tape'
import CrewFeed from './screens/CrewFeed'

export default function App() {
  const { user } = useAuth()

  // First visit (or after logout): must pick a name + PIN before anything else.
  if (!user) return <NamePinPicker />

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<CrewFeed />} />
        <Route path="/log" element={<LogEntry />} />
        <Route path="/tape" element={<Tape />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

function BottomNav() {
  return (
    <nav className="nav">
      <NavLink to="/" end>
        <span className="ico">📣</span>
        Crew
      </NavLink>
      <NavLink to="/log">
        <span className="ico">➕</span>
        Log
      </NavLink>
      <NavLink to="/tape">
        <span className="ico">📈</span>
        The Tape
      </NavLink>
    </nav>
  )
}
