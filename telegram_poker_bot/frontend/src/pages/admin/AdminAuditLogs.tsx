import { useState, useEffect, useCallback } from 'react'
import { adminGetAuditLogs, AdminAuditLogEntry } from '../../utils/apiClient'

/**
 * AdminAuditLogs - Audit log viewer page
 */
export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('')
  const [page, setPage] = useState(0)
  const pageSize = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminGetAuditLogs({
        limit: pageSize,
        offset: page * pageSize,
        action_type: actionTypeFilter || undefined,
      })
      setLogs(response.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, actionTypeFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  const getActionColor = (actionType: string): string => {
    switch (actionType) {
      case 'TOKEN_CREATED':
      case 'ENTER_SUCCESS':
        return '#22c55e'
      case 'ENTER_FAIL':
        return '#ef4444'
      case 'DEPOSIT':
        return '#16a34a'
      case 'WITHDRAW':
        return '#dc2626'
      case 'RESET_TABLE':
      case 'KICK_ALL':
        return '#f59e0b'
      case 'LOGOUT':
        return '#64748b'
      default:
        return '#3b82f6'
    }
  }

  const actionTypes = [
    'TOKEN_CREATED',
    'ENTER_SUCCESS',
    'ENTER_FAIL',
    'DEPOSIT',
    'WITHDRAW',
    'RESET_TABLE',
    'KICK_ALL',
    'LOGOUT',
  ]

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Audit Logs</h2>
        <p style={styles.subtitle}>Track all admin actions and security events</p>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Action Type</label>
          <select
            value={actionTypeFilter}
            onChange={(e) => {
              setActionTypeFilter(e.target.value)
              setPage(0)
            }}
            style={styles.select}
          >
            <option value="">All Actions</option>
            {actionTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <button onClick={fetchLogs} style={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Logs Table */}
      <div style={styles.logsContainer}>
        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={styles.empty}>No audit logs found</div>
        ) : (
          <>
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <div style={styles.colTime}>Timestamp</div>
                <div style={styles.colAction}>Action</div>
                <div style={styles.colAdmin}>Admin ID</div>
                <div style={styles.colTarget}>Target</div>
                <div style={styles.colReason}>Reason</div>
              </div>
              {logs.map((log) => (
                <div key={log.id} style={styles.tableRow}>
                  <div style={styles.colTime}>
                    <span style={styles.date}>{formatDate(log.timestamp)}</span>
                  </div>
                  <div style={styles.colAction}>
                    <span
                      style={{
                        ...styles.actionBadge,
                        backgroundColor: getActionColor(log.action_type),
                      }}
                    >
                      {log.action_type}
                    </span>
                  </div>
                  <div style={styles.colAdmin}>{log.admin_chat_id || '-'}</div>
                  <div style={styles.colTarget}>
                    {log.target || '-'}
                  </div>
                  <div style={styles.colReason}>
                    {log.reason || '-'}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div style={styles.metadata}>
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <span key={key} style={styles.metadataItem}>
                            <span style={styles.metadataKey}>{key}:</span>{' '}
                            <span style={styles.metadataValue}>{String(value)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={styles.pageButton}
              >
                ← Previous
              </button>
              <span style={styles.pageInfo}>Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logs.length < pageSize}
                style={styles.pageButton}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  filters: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    marginBottom: '24px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#94a3b8',
  },
  select: {
    padding: '10px 14px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
    minWidth: '180px',
  },
  refreshButton: {
    padding: '10px 16px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
    cursor: 'pointer',
  },
  error: {
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  logsContainer: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  loading: {
    padding: '48px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  empty: {
    padding: '48px',
    textAlign: 'center',
    color: '#64748b',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '180px 150px 100px 150px 1fr',
    gap: '12px',
    padding: '14px 20px',
    backgroundColor: '#334155',
    fontWeight: '600',
    fontSize: '13px',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '180px 150px 100px 150px 1fr',
    gap: '12px',
    padding: '14px 20px',
    borderBottom: '1px solid #334155',
    alignItems: 'center',
    fontSize: '14px',
  },
  colTime: {},
  colAction: {},
  colAdmin: {},
  colTarget: {},
  colReason: {
    overflow: 'hidden',
  },
  date: {
    color: '#94a3b8',
    fontSize: '13px',
  },
  actionBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  metadata: {
    marginTop: '4px',
    fontSize: '11px',
    color: '#64748b',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  metadataItem: {
    backgroundColor: '#334155',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  metadataKey: {
    color: '#94a3b8',
  },
  metadataValue: {
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderTop: '1px solid #334155',
  },
  pageButton: {
    padding: '8px 16px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  pageInfo: {
    fontSize: '14px',
    color: '#94a3b8',
  },
}
