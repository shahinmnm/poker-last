import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUp,
  faArrowDown,
  faCoins,
  faTrophy,
  faPercent,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

import { apiFetch } from '../utils/apiClient'
import { formatByCurrency, getTransactionTypeInfo } from '../utils/currency'

interface Transaction {
  id: number
  type: string
  amount: number
  balance_after: number
  reference_id: string | null
  metadata: Record<string, any>
  created_at: string | null
  currency_type?: 'REAL' | 'PLAY'
}

interface TransactionHistoryProps {
  limit?: number
}

export default function TransactionHistory({ limit = 20 }: TransactionHistoryProps) {
  const { t } = useTranslation()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiFetch<{ transactions: Transaction[] }>(
        '/users/me/transactions',
        {
          query: { limit, offset: 0 },
        },
      )
      const normalized = Array.isArray(response.transactions) ? response.transactions : []
      setTransactions(normalized)
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
      setError('Failed to load transaction history')
    } finally {
      setLoading(false)
      }
    }

    fetchTransactions()
  }, [limit])

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'arrow-up': faArrowUp,
      'arrow-down': faArrowDown,
      coins: faCoins,
      trophy: faTrophy,
      percent: faPercent,
    }
    return iconMap[iconName] || faCoins
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <FontAwesomeIcon
          icon={faSpinner}
          className="animate-spin text-2xl"
          style={{ color: 'var(--color-accent)' }}
        />
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.transactions.loading', 'Loading transactions...')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.transactions.empty', 'No transactions yet')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const typeInfo = getTransactionTypeInfo(transaction.type)
        const isPositive = transaction.amount > 0
        const currencyType = transaction.currency_type || 'REAL'

        return (
          <div
            key={transaction.id}
            className="rounded-xl p-3 transition-all hover:scale-[1.01]"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <FontAwesomeIcon
                  icon={getIcon(typeInfo.icon)}
                  className="text-sm"
                  style={{ color: typeInfo.color }}
                />
              </div>

              {/* Transaction Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {typeInfo.label}
                  </p>
                  <p
                    className="text-sm font-bold ml-2"
                    style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}
                  >
                    {isPositive ? '+' : ''}
                    {formatByCurrency(Math.abs(transaction.amount), currencyType)}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDate(transaction.created_at)}
                  </p>
                  <p className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                    Balance: {formatByCurrency(transaction.balance_after, currencyType)}
                  </p>
                </div>

                {/* Reference ID (optional) */}
                {transaction.reference_id && (
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
                    Ref: {transaction.reference_id}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
