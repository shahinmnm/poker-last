import { Outlet, Link, useLocation } from 'react-router-dom'

/**
 * AdminDashboard Layout Component
 * 
 * Provides navigation structure for admin pages.
 * No styling - structure only.
 */
export default function AdminDashboard() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/admin/analytics" data-active={isActive('/admin/analytics')}>
              Analytics
            </Link>
          </li>
          <li>
            <Link to="/admin/insights" data-active={isActive('/admin/insights')}>
              Insights
            </Link>
          </li>
          <li>
            <Link to="/admin/tables" data-active={isActive('/admin/tables')}>
              Tables
            </Link>
          </li>
        </ul>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
