import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Today    from './pages/Today'
import Plan     from './pages/Plan'
import Stats    from './pages/Stats'
import Settings from './pages/Settings'
import Widget   from './pages/Widget'
import Reminder from './pages/Reminder'
import Video    from './pages/Video'

const NAV_TABS = [
  { to: '/',         label: "Aujourd'hui", icon: 'ti-sun' },
  { to: '/plan',     label: 'Planifier',   icon: 'ti-calendar-plus' },
  { to: '/stats',    label: 'Tableau',     icon: 'ti-chart-bar' },
  { to: '/settings', label: 'Réglages',    icon: 'ti-settings' },
]

// Overlay pages have no navbar
const OVERLAY_ROUTES = ['/widget', '/reminder', '/video']

export default function App() {
  const { pathname } = useLocation()
  const isOverlay = OVERLAY_ROUTES.some(r => pathname.startsWith(r))

  if (isOverlay) {
    return (
      <Routes>
        <Route path="/widget"   element={<Widget />} />
        <Route path="/reminder" element={<Reminder />} />
        <Route path="/video"    element={<Video />} />
      </Routes>
    )
  }

  return (
    <div className="app" style={{ maxWidth: 740, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        display: 'flex', gap: 2, padding: '12px 16px 0',
        background: '#160d30',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        flexShrink: 0,
      }}>
        {NAV_TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 13, marginRight: 4 }} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main style={{ flex: 1, padding: '20px 16px 24px', overflowY: 'auto' }}>
        <Routes>
          <Route path="/"         element={<Today />} />
          <Route path="/plan"     element={<Plan />} />
          <Route path="/stats"    element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
