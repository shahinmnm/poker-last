import { useState, useEffect, useCallback } from 'react'
import {
  adminListUsers,
  adminGetUserWallet,
  AdminUserSummary,
  AdminUserWallet,
} from '../../utils/apiClient'

/**
 * AdminPlayers - Player search and management page
 */
export default function AdminPlayers() {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUserWallet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async (search?: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminListUsers({
        search: search || undefined,
        limit: 50,
      })
      setUsers(response.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(searchQuery)
  }

  const handleSelectUser = async (userId: number) => {
    try {
      const wallet = await adminGetUserWallet(userId)
      setSelectedUser(wallet)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user wallet')
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Players</h2>
        <p style={styles.subtitle}>Search and manage user accounts</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} style={styles.searchForm}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username, user ID, or Telegram ID..."
          style={styles.searchInput}
        />
        <button type="submit" style={styles.searchButton} disabled={loading}>
          🔍 Search
        </button>
      </form>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        {/* Users List */}
        <div style={styles.usersList}>
          <h3 style={styles.sectionTitle}>
            Users {users.length > 0 && `(${users.length})`}
          </h3>
          
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : users.length === 0 ? (
            <div style={styles.empty}>No users found</div>
          ) : (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <div style={styles.tableCell}>ID</div>
                <div style={styles.tableCell}>Username</div>
                <div style={styles.tableCell}>Real Balance</div>
                <div style={styles.tableCell}>Play Balance</div>
                <div style={styles.tableCell}>Actions</div>
              </div>
              {users.map((user) => (
                <div key={user.id} style={styles.tableRow}>
                  <div style={styles.tableCell}>{user.id}</div>
                  <div style={styles.tableCell}>
                    {user.username || <span style={styles.muted}>No username</span>}
                  </div>
                  <div style={styles.tableCell}>
                    {formatCurrency(user.balance_real)}
                  </div>
                  <div style={styles.tableCell}>
                    {formatCurrency(user.balance_play)}
                  </div>
                  <div style={styles.tableCell}>
                    <button
                      onClick={() => handleSelectUser(user.id)}
                      style={styles.viewButton}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Detail Panel */}
        {selectedUser && (
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              <h3 style={styles.sectionTitle}>User Details</h3>
              <button
                onClick={() => setSelectedUser(null)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.detailContent}>
              <div style={styles.detailSection}>
                <h4 style={styles.detailLabel}>User Info</h4>
                <div style={styles.detailItem}>
                  <span>ID:</span>
                  <span>{selectedUser.user.id}</span>
                </div>
                <div style={styles.detailItem}>
                  <span>Telegram ID:</span>
                  <span>{selectedUser.user.tg_user_id}</span>
                </div>
                <div style={styles.detailItem}>
                  <span>Username:</span>
                  <span>{selectedUser.user.username || '-'}</span>
                </div>
              </div>

              <div style={styles.detailSection}>
                <h4 style={styles.detailLabel}>Wallet</h4>
                <div style={styles.balanceCards}>
                  <div style={styles.balanceCard}>
                    <span style={styles.balanceLabel}>Real Balance</span>
                    <span style={styles.balanceValue}>
                      {formatCurrency(selectedUser.wallet.balance_real)}
                    </span>
                  </div>
                  <div style={styles.balanceCard}>
                    <span style={styles.balanceLabel}>Play Balance</span>
                    <span style={styles.balanceValue}>
                      {formatCurrency(selectedUser.wallet.balance_play)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={styles.detailSection}>
                <h4 style={styles.detailLabel}>Recent Transactions</h4>
                {selectedUser.recent_transactions.length === 0 ? (
                  <div style={styles.empty}>No transactions</div>
                ) : (
                  <div style={styles.transactionsList}>
                    {selectedUser.recent_transactions.map((tx) => (
                      <div key={tx.id} style={styles.transactionItem}>
                        <div style={styles.txType}>{tx.type}</div>
                        <div style={{
                          ...styles.txAmount,
                          color: tx.amount >= 0 ? '#22c55e' : '#ef4444',
                        }}>
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </div>
                        <div style={styles.txDate}>{formatDate(tx.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
  searchForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
  },
  searchButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  error: {
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: selectedUser ? '1fr 400px' : '1fr',
    gap: '24px',
  },
  usersList: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    color: '#f8fafc',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748b',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 120px 120px 80px',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#334155',
    borderRadius: '8px 8px 0 0',
    fontWeight: '600',
    fontSize: '13px',
    color: '#94a3b8',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 120px 120px 80px',
    gap: '12px',
    padding: '12px',
    borderBottom: '1px solid #334155',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: '14px',
  },
  muted: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailPanel: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #334155',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer',
  },
  detailContent: {
    padding: '20px',
  },
  detailSection: {
    marginBottom: '20px',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '12px',
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #334155',
    fontSize: '14px',
  },
  balanceCards: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  balanceCard: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
  },
  balanceLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px',
  },
  balanceValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#22c55e',
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  transactionItem: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr auto',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#334155',
    borderRadius: '6px',
    fontSize: '13px',
    alignItems: 'center',
  },
  txType: {
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontSize: '11px',
    fontWeight: '600',
  },
  txAmount: {
    fontWeight: '600',
    textAlign: 'right',
  },
  txDate: {
    color: '#64748b',
    fontSize: '12px',
  },
}
