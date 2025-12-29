import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { redeemAdminEntryToken } from '../../utils/apiClient'

/**
 * AdminEnter Page
 *
 * SPA route that handles /admin/enter?token=...
 *
 * This page:
 * 1. Reads the token from query string
 * 2. Shows a loading UI while validating
 * 3. Calls POST /api/admin/redeem-entry-token
 * 4. On success: navigates to /admin/panel (which redirects to /admin/analytics)
 * 5. On failure: navigates to /admin/expired?reason=invalid_token
 *
 * This route must NOT render the game or any game layout - it is admin-only.
 */
export default function AdminEnter() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasAttemptedRef = useRef(false)

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasAttemptedRef.current) {
      return
    }
    hasAttemptedRef.current = true

    const token = searchParams.get('token')

    // If token is missing, redirect to expired page
    if (!token) {
      if (import.meta.env.DEV) {
        console.log('[AdminEnter] No token provided, redirecting to expired')
      }
      navigate('/admin/expired?reason=invalid_token', { replace: true })
      return
    }

    // Call the redeem endpoint
    const redeemToken = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log('[AdminEnter] Attempting to redeem token (prefix):', token.slice(0, 8))
        }

        const result = await redeemAdminEntryToken(token)

        if (result.ok) {
          if (import.meta.env.DEV) {
            console.log('[AdminEnter] Token redeemed successfully, redirecting to:', result.redirect)
          }
          // Navigate to the admin panel
          navigate(result.redirect || '/admin/panel', { replace: true })
        } else {
          // Token was invalid
          if (import.meta.env.DEV) {
            console.log('[AdminEnter] Token redemption failed:', result.reason)
          }
          navigate(`/admin/expired?reason=${result.reason || 'invalid_token'}`, { replace: true })
        }
      } catch (error) {
        // Network error or API error
        if (import.meta.env.DEV) {
          console.error('[AdminEnter] Error redeeming token:', error)
        }
        setStatus('error')
        setErrorMessage('Failed to validate token. Please try again.')
        // After a brief delay, redirect to expired
        setTimeout(() => {
          navigate('/admin/expired?reason=invalid_token', { replace: true })
        }, 2000)
      }
    }

    redeemToken()
  }, [searchParams, navigate])

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' ? (
          <>
            <div style={styles.spinner} />
            <h1 style={styles.title}>Signing you in…</h1>
            <p style={styles.message}>Please wait while we validate your access.</p>
          </>
        ) : (
          <>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Error</h1>
            <p style={styles.message}>{errorMessage}</p>
            <p style={styles.hint}>Redirecting…</p>
          </>
        )}
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
    maxWidth: '400px',
    border: '1px solid #334155',
    color: '#e2e8f0',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #334155',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#f8fafc',
    margin: '0 0 12px 0',
  },
  message: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  hint: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '12px',
  },
}

// Add CSS animation for spinner (injected once)
if (typeof document !== 'undefined') {
  const styleId = 'admin-enter-spinner-style'
  if (!document.getElementById(styleId)) {
    const styleSheet = document.createElement('style')
    styleSheet.id = styleId
    styleSheet.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(styleSheet)
  }
}
