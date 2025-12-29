import { useState, useEffect, useCallback } from 'react'
import {
  adminListUsers,
  adminDeposit,
  adminWithdraw,
  adminListTransactions,
  AdminUserSummary,
  AdminTransactionSummary,
} from '../../utils/apiClient'

/**
 * AdminBanking - Deposit/Withdraw management page
 */
export default function AdminBanking() {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [transactions, setTransactions] = useState<AdminTransactionSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [operation, setOperation] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [currencyType, setCurrencyType] = useState<'REAL' | 'PLAY'>('REAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const fetchUsers = useCallback(async (search?: string) => {
    try {
      const response = await adminListUsers({
        search: search || undefined,
        limit: 20,
      })
      setUsers(response.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await adminListTransactions({
        limit: 50,
      })
      setTransactions(response.transactions)
    } catch (err) {
      // Ignore errors for transactions
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchTransactions()
  }, [fetchUsers, fetchTransactions])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers(searchQuery)
  }

  const handleSubmit = async () => {
    if (!selectedUserId || !amount || !reason) {
      setError('Please fill in all fields')
      return
    }

    const amountCents = Math.round(parseFloat(amount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const clientActionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      if (operation === 'deposit') {
        await adminDeposit(selectedUserId, {
          amount: amountCents,
          reason,
          currency_type: currencyType,
          client_action_id: clientActionId,
        })
        setSuccess(`Successfully deposited $${amount} to user ${selectedUserId}`)
      } else {
        await adminWithdraw(selectedUserId, {
          amount: amountCents,
          reason,
          currency_type: currencyType,
          client_action_id: clientActionId,
        })
        setSuccess(`Successfully withdrew $${amount} from user ${selectedUserId}`)
      }

      // Reset form
      setAmount('')
      setReason('')
      setShowConfirmation(false)

      // Refresh data
      fetchUsers(searchQuery)
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const selectedUser = users.find(u => u.id === selectedUserId)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Banking Operations</h2>
        <p style={styles.subtitle}>Deposit and withdraw funds from user accounts</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.content}>
        {/* Operation Form */}
        <div style={styles.formPanel}>
          <h3 style={styles.sectionTitle}>New Operation</h3>

          {/* User Search */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Select User</label>
            <form onSubmit={handleSearch} style={styles.searchForm}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user..."
                style={styles.input}
              />
              <button type="submit" style={styles.searchButton}>🔍</button>
            </form>
            
            <div style={styles.userSelect}>
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  style={{
                    ...styles.userOption,
                    ...(selectedUserId === user.id ? styles.userOptionSelected : {}),
                  }}
                >
                  <div style={styles.userName}>
                    {user.username || `User ${user.id}`}
                  </div>
                  <div style={styles.userBalance}>
                    Real: {formatCurrency(user.balance_real)} | Play: {formatCurrency(user.balance_play)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedUser && (
            <>
              {/* Operation Type */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Operation</label>
                <div style={styles.operationButtons}>
                  <button
                    onClick={() => setOperation('deposit')}
                    style={{
                      ...styles.operationButton,
                      ...(operation === 'deposit' ? styles.depositActive : {}),
                    }}
                  >
                    💰 Deposit
                  </button>
                  <button
                    onClick={() => setOperation('withdraw')}
                    style={{
                      ...styles.operationButton,
                      ...(operation === 'withdraw' ? styles.withdrawActive : {}),
                    }}
                  >
                    💸 Withdraw
                  </button>
                </div>
              </div>

              {/* Currency Type */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Currency</label>
                <div style={styles.currencyButtons}>
                  <button
                    onClick={() => setCurrencyType('REAL')}
                    style={{
                      ...styles.currencyButton,
                      ...(currencyType === 'REAL' ? styles.currencyActive : {}),
                    }}
                  >
                    Real Money
                  </button>
                  <button
                    onClick={() => setCurrencyType('PLAY')}
                    style={{
                      ...styles.currencyButton,
                      ...(currencyType === 'PLAY' ? styles.currencyActive : {}),
                    }}
                  >
                    Play Money
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={styles.input}
                />
              </div>

              {/* Reason */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Reason (Required)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for this operation..."
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              {/* Submit */}
              {!showConfirmation ? (
                <button
                  onClick={() => setShowConfirmation(true)}
                  disabled={!amount || !reason}
                  style={{
                    ...styles.submitButton,
                    ...(operation === 'deposit' ? styles.depositButton : styles.withdrawButton),
                    opacity: !amount || !reason ? 0.5 : 1,
                  }}
                >
                  Review {operation === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </button>
              ) : (
                <div style={styles.confirmationBox}>
                  <h4 style={styles.confirmTitle}>⚠️ Confirm Operation</h4>
                  <p style={styles.confirmText}>
                    You are about to {operation} <strong>{formatCurrency(Math.round((parseFloat(amount) || 0) * 100))}</strong>{' '}
                    ({currencyType}) {operation === 'deposit' ? 'to' : 'from'} user <strong>{selectedUser.username || selectedUser.id}</strong>.
                  </p>
                  <p style={styles.confirmReason}>Reason: {reason}</p>
                  <div style={styles.confirmButtons}>
                    <button
                      onClick={() => setShowConfirmation(false)}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      style={{
                        ...styles.confirmButton,
                        ...(operation === 'deposit' ? styles.depositButton : styles.withdrawButton),
                      }}
                    >
                      {loading ? 'Processing...' : `Confirm ${operation}`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent Transactions */}
        <div style={styles.transactionsPanel}>
          <h3 style={styles.sectionTitle}>Recent Transactions</h3>
          
          <div style={styles.transactionsList}>
            {transactions.length === 0 ? (
              <div style={styles.empty}>No transactions yet</div>
            ) : (
              transactions.map((tx) => {
                const adminReason = tx.metadata?.admin_reason
                const adminReasonText = typeof adminReason === 'string' && adminReason.length > 0 ? adminReason : null

                return (
                  <div key={tx.id} style={styles.transactionItem}>
                    <div style={styles.txHeader}>
                      <span style={{
                        ...styles.txType,
                        backgroundColor: tx.type === 'deposit' ? '#16a34a' : '#dc2626',
                      }}>
                        {tx.type.toUpperCase()}
                      </span>
                      <span style={styles.txUser}>User #{tx.user_id}</span>
                    </div>
                    <div style={styles.txDetails}>
                      <span style={{
                        ...styles.txAmount,
                        color: tx.amount >= 0 ? '#22c55e' : '#ef4444',
                      }}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </span>
                      <span style={styles.txCurrency}>{tx.currency_type}</span>
                    </div>
                    <div style={styles.txFooter}>
                      <span style={styles.txDate}>{formatDate(tx.created_at)}</span>
                      {adminReasonText && (
                        <span style={styles.txReason}>{adminReasonText}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
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
  error: {
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  success: {
    backgroundColor: '#14532d',
    color: '#bbf7d0',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  formPanel: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #334155',
  },
  transactionsPanel: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #334155',
    maxHeight: '700px',
    overflow: 'auto',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 20px 0',
    color: '#f8fafc',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  searchForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#334155',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#334155',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  searchButton: {
    padding: '10px 14px',
    backgroundColor: '#475569',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  userSelect: {
    maxHeight: '200px',
    overflow: 'auto',
    border: '1px solid #334155',
    borderRadius: '8px',
  },
  userOption: {
    padding: '12px',
    cursor: 'pointer',
    borderBottom: '1px solid #334155',
    transition: 'background-color 0.2s',
  },
  userOptionSelected: {
    backgroundColor: '#334155',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#f8fafc',
  },
  userBalance: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  operationButtons: {
    display: 'flex',
    gap: '8px',
  },
  operationButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#334155',
    border: '2px solid transparent',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  depositActive: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
    color: '#22c55e',
  },
  withdrawActive: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
    color: '#ef4444',
  },
  currencyButtons: {
    display: 'flex',
    gap: '8px',
  },
  currencyButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#334155',
    border: '2px solid transparent',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '13px',
    cursor: 'pointer',
  },
  currencyActive: {
    borderColor: '#3b82f6',
    color: '#3b82f6',
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  depositButton: {
    backgroundColor: '#16a34a',
  },
  withdrawButton: {
    backgroundColor: '#dc2626',
  },
  confirmationBox: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '20px',
    border: '2px solid #f59e0b',
  },
  confirmTitle: {
    margin: '0 0 12px 0',
    color: '#fbbf24',
    fontSize: '16px',
  },
  confirmText: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  confirmReason: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  confirmButtons: {
    display: 'flex',
    gap: '12px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#475569',
    border: 'none',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '14px',
    cursor: 'pointer',
  },
  confirmButton: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748b',
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  transactionItem: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '14px',
  },
  txHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  txType: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '4px',
    color: '#fff',
  },
  txUser: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  txDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  txAmount: {
    fontSize: '18px',
    fontWeight: '700',
  },
  txCurrency: {
    fontSize: '12px',
    color: '#64748b',
    backgroundColor: '#475569',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  txFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txDate: {
    fontSize: '12px',
    color: '#64748b',
  },
  txReason: {
    fontSize: '12px',
    color: '#94a3b8',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
