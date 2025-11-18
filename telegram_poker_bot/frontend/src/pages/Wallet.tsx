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
        <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faWallet} style={{ color: 'var(--accent-blue)' }} />
          {t('wallet.title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('menu.wallet.description')}</p>
      </header>

      <section 
        id="balance" 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--color-border-glass)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Diagonal highlight */}
        <div 
          className="absolute top-0 left-[20%] right-[20%] h-[40%] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent)',
            borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
          }}
        />
        
        <div className="relative z-10">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{t('wallet.balance')}</h2>
          <div className="mt-4 flex items-center gap-4">
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
                boxShadow: '0 0 24px rgba(34, 197, 94, 0.5)',
              }}
            >
              <FontAwesomeIcon icon={faWallet} className="text-3xl text-white" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Your Balance</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--accent-green)' }}>
                {balance.toLocaleString()} chips
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Use your chips to buy into poker tables and tournaments.
          </p>
        </div>
      </section>

      <section 
        id="info" 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--color-border-glass)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ color: 'var(--accent-blue)' }} />
          About Chips
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Chips are used for playing poker. When you join a table, chips are reserved for your buy-in.
          When you leave, your remaining chips return to your wallet.
        </p>
      </section>

      <section 
        id="history" 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--color-border-glass)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faClockRotateLeft} style={{ color: 'var(--color-text)' }} />
          {t('wallet.history.title')}
        </h2>
        <div className="mt-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Transaction history coming soon! For now, check your game history in the Stats page.
          </p>
        </div>
      </section>
    </div>
  )
}
