import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const navLinks = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/inventory', label: 'Inventory' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { logout, user } = useAuth()
  const isOwner = user?.role === 'owner'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <nav className="bg-indigo-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <span className="text-white font-bold text-xl tracking-widest select-none">
                INVENTRACK
              </span>
            </div>

            {/* Nav links — centered on larger screens */}
            <div className="hidden sm:flex sm:items-center sm:gap-1">
              {navLinks.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    [
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
                    ].join(' ')
                  }
                >
                  {label}
                </NavLink>
              ))}
              {/* Staff link — owners only (Requirement 7.7) */}
              {isOwner && (
                <NavLink
                  to="/staff"
                  className={({ isActive }) =>
                    [
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
                    ].join(' ')
                  }
                >
                  Staff
                </NavLink>
              )}
            </div>

            {/* Right side: notification bell slot + user menu */}
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <NotificationBell />

              {/* User info + logout */}
              {user && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block text-indigo-200 text-sm">
                    {user.name}
                    {user.role === 'owner' && (
                      <span className="ml-1 text-xs text-indigo-400">(owner)</span>
                    )}
                  </span>
                  <button
                    onClick={logout}
                    className="text-indigo-300 hover:text-white text-sm font-medium transition-colors duration-150"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav links */}
        <div className="sm:hidden border-t border-indigo-800">
          <div className="flex overflow-x-auto px-2 py-1 gap-1">
            {navLinks.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            ))}
            {/* Staff link — owners only (Requirement 7.7) */}
            {isOwner && (
              <NavLink
                to="/staff"
                className={({ isActive }) =>
                  [
                    'flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
                  ].join(' ')
                }
              >
                Staff
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
