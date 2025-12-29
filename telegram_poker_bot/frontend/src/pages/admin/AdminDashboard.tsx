import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { adminValidateSession, adminLogout, adminGetDashboardKPIs } from '../../utils/apiClient'

// Icons for navigation
const icons = {
  dashboard: '📊',
  analytics: '📈',
  insights: '💡',
  tables: '🎰',
  templates: '📋',
  players: '👥',
  banking: '💰',
  audit: '📝',
  logout: '🚪',
}

interface NavItem {
  path: string
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { path: '/admin/analytics', label: 'Dashboard', icon: icons.dashboard },
  { path: '/admin/insights', label: 'Insights', icon: icons.insights },
  { path: '/admin/tables', label: 'Tables', icon: icons.tables },
  { path: '/admin/table-templates', label: 'Templates', icon: icons.templates },
  { path: '/admin/players', label: 'Players', icon: icons.players },
  { path: '/admin/banking', label: 'Banking', icon: icons.banking },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: icons.audit },
]

/**
 * AdminDashboard Layout Component
 * 
 * Provides navigation structure for admin pages with session validation.
 * Professional ops dashboard UI with sidebar navigation.
 */
export default function AdminDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessionValid, setSessionValid] = useState<boolean | null>(null)
  const [adminChatId, setAdminChatId] = useState<number | null>(null)
  const [kpis, setKpis] = useState<{
    stuck_tables?: number
    active_tables?: number
  } | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Check session on mount and periodically
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await adminValidateSession()
        setSessionValid(response.valid)
        if (response.valid && response.admin_chat_id) {
          setAdminChatId(response.admin_chat_id)
        }
      } catch {
        setSessionValid(false)
      }
    }

    checkSession()
    const interval = setInterval(checkSession, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  // Fetch KPIs for sidebar badges
  useEffect(() => {
    if (!sessionValid) return

    const fetchKPIs = async () => {
      try {
        const response = await adminGetDashboardKPIs()
        setKpis(response.kpis)
      } catch {
        // Ignore errors
      }
    }

    fetchKPIs()
    const interval = setInterval(fetchKPIs, 30000) // Update every 30s
    return () => clearInterval(interval)
  }, [sessionValid])

  const handleLogout = async () => {
    try {
      await adminLogout()
    } catch {
      // Ignore errors
    }
    setSessionValid(false)
  }

  const isActive = (path: string) => location.pathname === path

  // Show loading state while checking session
  if (sessionValid === null) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>⏳</div>
        <p>Validating admin session...</p>
      </div>
    )
  }

  // Show session expired message
  if (!sessionValid) {
    return (
      <div style={styles.sessionExpiredContainer}>
        <div style={styles.sessionExpiredCard}>
          <div style={styles.sessionExpiredIcon}>🔒</div>
          <h1 style={styles.sessionExpiredTitle}>Session Expired</h1>
          <p style={styles.sessionExpiredText}>
            Your admin session has expired or is invalid.
          </p>
          <p style={styles.sessionExpiredInstructions}>
            Please use the <code style={styles.code}>/admin</code> command in Telegram
            to generate a new access link.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={styles.refreshButton}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? '60px' : '240px',
      }}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>♠️</span>
          {!sidebarCollapsed && <span style={styles.logoText}>Admin Panel</span>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={styles.collapseButton}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav style={styles.nav}>
          <ul style={styles.navList}>
            {navItems.map((item) => (
              <li key={item.path} style={styles.navItem}>
                <Link
                  to={item.path}
                  style={{
                    ...styles.navLink,
                    ...(isActive(item.path) ? styles.navLinkActive : {}),
                  }}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span style={styles.navLabel}>{item.label}</span>
                      {/* Show badge for stuck tables */}
                      {item.path === '/admin/tables' && kpis?.stuck_tables && kpis.stuck_tables > 0 && (
                        <span style={styles.badge}>{kpis.stuck_tables}</span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={styles.sidebarFooter}>
          {!sidebarCollapsed && adminChatId && (
            <div style={styles.adminInfo}>
              Admin ID: {adminChatId}
            </div>
          )}
          <button onClick={handleLogout} style={styles.logoutButton}>
            <span>{icons.logout}</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>
              {navItems.find(item => isActive(item.path))?.label || 'Admin'}
            </h1>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.envBadge}>
              {window.location.hostname.includes('localhost') ? '🟡 DEV' : '🟢 PROD'}
            </span>
          </div>
        </header>

        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  sidebar: {
    backgroundColor: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    borderRight: '1px solid #334155',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #334155',
    gap: '8px',
  },
  logo: {
    fontSize: '24px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 'bold',
    flex: 1,
  },
  collapseButton: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
  },
  nav: {
    flex: 1,
    padding: '8px',
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  navItem: {
    marginBottom: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    color: '#94a3b8',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    gap: '10px',
  },
  navLinkActive: {
    backgroundColor: '#334155',
    color: '#f8fafc',
  },
  navIcon: {
    fontSize: '18px',
    minWidth: '24px',
    textAlign: 'center',
  },
  navLabel: {
    flex: 1,
  },
  badge: {
    backgroundColor: '#dc2626',
    color: '#fff',
    borderRadius: '10px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid #334155',
  },
  adminInfo: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '8px',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #334155',
    backgroundColor: '#1e293b',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
  },
  envBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#334155',
    borderRadius: '4px',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  loadingSpinner: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  sessionExpiredContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '24px',
  },
  sessionExpiredCard: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '48px',
    textAlign: 'center',
    maxWidth: '480px',
    border: '1px solid #334155',
  },
  sessionExpiredIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  sessionExpiredTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: '16px',
  },
  sessionExpiredText: {
    fontSize: '16px',
    color: '#94a3b8',
    marginBottom: '12px',
  },
  sessionExpiredInstructions: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '24px',
  },
  code: {
    backgroundColor: '#334155',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '500',
  },
}
