import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import NamePinPicker from './screens/NamePinPicker'
import LogEntry from './screens/LogEntry'
import CrewFeed from './screens/CrewFeed'
import CheckIn from './screens/CheckIn'
import Profile from './screens/Profile'

export default function App() {
  const { user } = useAuth()

  // First visit (or after logout): must pick a name + PIN before anything else.
  if (!user) return <NamePinPicker />

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<CrewFeed />} />
        <Route path="/today" element={<CheckIn />} />
        <Route path="/log" element={<LogEntry />} />
        {/* Your own profile, and anyone else's. Same screen. */}
        <Route path="/me" element={<Profile />} />
        <Route path="/crew/:userId" element={<Profile />} />
        {/* The tape tab became /me; keep old links and cached clients working. */}
        <Route path="/tape" element={<Navigate to="/me" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav user={user} />
    </div>
  )
}

function BottomNav({ user }) {
  return (
    <nav className="nav">
      {/* Emoji are the nav's only ornament — except the last tab, which is
          your own avatar. */}
      <NavLink to="/" end>
        <span className="ico">📣</span>
        Crew
      </NavLink>
      <NavLink to="/today">
        <span className="ico">🔥</span>
        Today
      </NavLink>
      <NavLink to="/log">
        <span className="ico">✍️</span>
        Log
      </NavLink>
      {/* Your own face rather than an emoji — same visual language as the
          crew row, and it makes the tab unmistakably "you". */}
      <NavLink to="/me">
        <span className="ico">
          <span className="avatar nav-avatar" style={{ '--user': user.color }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
        </span>
        You
      </NavLink>
    </nav>
  )
}
