import { useEffect, useState } from 'react'
import axios from 'axios'

interface Transaction {
  id: number
  type: 'buy_in' | 'cash_out' | 'game_win' | 'game_bet' | 'deposit' | 'withdrawal'
  amount: number
  balance_after: number
  currency_type: 'REAL' | 'PLAY'
  created_at: string
}

const formatAmount = (value: number, currencyType: Transaction['currency_type']) =>
  currencyType === 'PLAY'
    ? value.toLocaleString('en-US')
    : `$${(value / 100).toFixed(2)}`

const typeLabels: Record<Transaction['type'], string> = {
  buy_in: 'Table Buy-in',
  cash_out: 'Cash Out',
  game_win: 'Game Win',
  game_bet: 'Game Bet',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
}

const isCredit = (type: Transaction['type']) =>
  ['deposit', 'cash_out', 'game_win'].includes(type)

const typeIcon = (type: Transaction['type']) =>
  isCredit(type) ? '↑' : '↓'

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get<{ transactions: Transaction[] }>('/users/me/transactions')
        const payload = response.data?.transactions ?? (response.data as unknown as Transaction[])
        setTransactions(payload || [])
      } catch (err) {
        console.error('Failed to fetch transactions', err)
        setError('Unable to load transactions right now.')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-white/70">Loading transaction history...</div>
    )
  }

  if (error) {
    return <div className="py-6 text-center text-sm text-red-400">{error}</div>
  }

  if (!transactions.length) {
    return <div className="py-6 text-center text-sm text-white/60">No transactions yet.</div>
  }

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {transactions.map((transaction) => {
        const credit = isCredit(transaction.type)
        const amountLabel = `${credit ? '+' : '-'}${formatAmount(Math.abs(transaction.amount), transaction.currency_type)}`
        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg font-semibold ${
                  credit ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {typeIcon(transaction.type)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{typeLabels[transaction.type]}</p>
                <p className="text-xs text-white/60">
                  {new Date(transaction.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${credit ? 'text-emerald-400' : 'text-red-400'}`}>{amountLabel}</p>
              <p className="text-[11px] text-white/60">
                Balance: {formatAmount(transaction.balance_after, transaction.currency_type)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
