import { useSearchParams } from 'react-router-dom'

/**
 * AdminExpired Page
 * 
 * Shown when:
 * - Admin session has expired
 * - Admin one-time link is invalid or already used
 * - User tries to access admin routes without authentication
 * - User has logged out
 * 
 * Prompts user to generate a new access link via Telegram /admin command.
 */
export default function AdminExpired() {
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason')

  // Determine message based on reason
  let title = 'Session Expired'
  let message = 'Your admin session has expired or is invalid.'
  let icon = '🔒'

  if (reason === 'invalid_token') {
    title = 'Link Expired or Invalid'
    message = 'This admin link has expired or was already used (single-use).'
  } else if (reason === 'rate_limited') {
    title = 'Too Many Requests'
    message = 'You have made too many requests. Please wait a moment before trying again.'
  } else if (reason === 'no_session') {
    title = 'Not Authenticated'
    message = 'You need to authenticate as an admin to access this page.'
  } else if (reason === 'logged_out') {
    title = 'Logged Out'
    message = 'You have been successfully logged out.'
    icon = '👋'
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>{icon}</div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.message}>{message}</p>
        <p style={styles.instructions}>
          Please use the <code style={styles.code}>/admin</code> command in Telegram
          to generate a new access link.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={styles.button}
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '24px',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '48px',
    textAlign: 'center',
    maxWidth: '480px',
    border: '1px solid #334155',
    color: '#e2e8f0',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#f8fafc',
    margin: '0 0 16px 0',
  },
  message: {
    fontSize: '16px',
    color: '#94a3b8',
    margin: '0 0 12px 0',
  },
  instructions: {
    fontSize: '14px',
    color: '#64748b',
    margin: '0 0 24px 0',
  },
  code: {
    backgroundColor: '#334155',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  button: {
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
