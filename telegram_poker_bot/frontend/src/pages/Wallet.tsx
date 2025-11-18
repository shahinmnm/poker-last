import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWallet, faCircleInfo, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

export default function WalletPage() {
  const { t } = useTranslation()
  const { initData } = useTelegram()
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBalance = async () => {
      if (!initData) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        const balanceData = await apiFetch<{ balance: number }>('/users/me/balance', { initData })
        setBalance(balanceData.balance)
      } catch (err) {
        console.error('Error fetching balance:', err)
        setError('Failed to load balance')
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [initData])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/40 dark:text-red-200">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FontAwesomeIcon icon={faWallet} />
          {t('wallet.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('menu.wallet.description')}</p>
      </header>

      <section id="balance" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('wallet.balance')}</h2>
        <div className="mt-4 flex items-center gap-3">
          <FontAwesomeIcon icon={faWallet} className="text-4xl text-emerald-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your Balance</p>
            <p className="text-3xl font-bold text-emerald-500">
              {balance.toLocaleString()} chips
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          Use your chips to buy into poker tables and tournaments.
        </p>
      </section>

      <section id="info" className="rounded-2xl bg-blue-50 p-5 dark:bg-blue-950/40">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <FontAwesomeIcon icon={faCircleInfo} />
          About Chips
        </h3>
        <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
          Chips are used for playing poker. When you join a table, chips are reserved for your buy-in.
          When you leave, your remaining chips return to your wallet.
        </p>
      </section>

      <section id="history" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FontAwesomeIcon icon={faClockRotateLeft} />
          {t('wallet.history.title')}
        </h2>
        <div className="mt-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Transaction history coming soon! For now, check your game history in the Stats page.
          </p>
        </div>
      </section>
    </div>
  )
}
