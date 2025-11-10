import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type TransactionType = 'deposit' | 'buyIn' | 'payout'

const demoTransactions: Array<{
  id: string
  type: TransactionType
  amount: string
  timestamp: string
}> = [
  { id: 'txn-1', type: 'deposit', amount: '+1,000', timestamp: '2025-11-10 14:22' },
  { id: 'txn-2', type: 'buyIn', amount: '-500', timestamp: '2025-11-09 21:10' },
  { id: 'txn-3', type: 'payout', amount: '+320', timestamp: '2025-11-09 23:58' },
]

export default function WalletPage() {
  const { t } = useTranslation()

  const balance = useMemo(
    () => ({
      chips: '2,450',
      available: '1,950',
      reserved: '500',
    }),
    [],
  )

  const primaryActions = [
    { key: 'deposit', label: t('wallet.actions.deposit'), color: 'bg-emerald-500 hover:bg-emerald-600' },
    { key: 'withdraw', label: t('wallet.actions.withdraw'), color: 'bg-amber-500 hover:bg-amber-600' },
    { key: 'transfer', label: t('wallet.actions.transfer'), color: 'bg-blue-500 hover:bg-blue-600' },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('wallet.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('menu.wallet.description')}</p>
      </header>

      <section id="balance" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('wallet.balance')}</h2>
        <p className="mt-2 text-3xl font-bold text-emerald-500">
          {t('wallet.chips', { amount: balance.chips })}
        </p>
        <div className="mt-4 grid gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
            <p className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('menu.wallet.children.balance')}</p>
            <p className="mt-2 text-lg font-semibold">{balance.available}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
            <p className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('menu.wallet.children.deposit')}</p>
            <p className="mt-2 text-lg font-semibold">{balance.reserved}</p>
          </div>
        </div>
      </section>

      <section id="deposit" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('menu.wallet.children.deposit')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {primaryActions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={`${action.color} rounded-xl px-4 py-3 text-sm font-semibold text-white transition`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section id="history" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('wallet.history.title')}</h2>
        <div className="mt-3 space-y-3">
          {demoTransactions.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('wallet.history.empty')}</p>
          ) : (
            demoTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-gray-700"
              >
                <div>
                  <p className="font-semibold">
                    {t(`wallet.transactions.${transaction.type}`)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{transaction.timestamp}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    transaction.amount.startsWith('+')
                      ? 'text-emerald-500 dark:text-emerald-300'
                      : 'text-red-500 dark:text-red-300'
                  }`}
                >
                  {transaction.amount}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
