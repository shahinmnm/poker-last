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
        setError(t('wallet.errors.loadFailed', 'Failed to load balance'))
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [initData, t])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--color-danger-glass)',
          border: '1px solid var(--color-danger-glass-border)',
          color: 'var(--color-danger)',
        }}
      >
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faWallet} style={{ color: 'var(--accent-blue)' }} />
          {t('wallet.title', 'Wallet')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.subtitle', 'Manage your chip balance')}
        </p>
      </header>

      <section 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="absolute top-0 left-[20%] right-[20%] h-[40%] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent)',
            borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
          }}
        />
        
        <div className="relative z-10">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {t('wallet.balance', 'Balance')}
          </h2>
          <div className="mt-4 flex items-center gap-4">
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
              }}
            >
              <FontAwesomeIcon icon={faWallet} className="text-3xl text-white" />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('wallet.yourBalance', 'Your Balance')}
              </p>
              <p className="text-3xl font-bold" style={{ color: 'var(--accent-green)' }}>
                {balance.toLocaleString()} {t('wallet.chips', 'chips')}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('wallet.description', 'Use your chips to buy into poker tables and tournaments.')}
          </p>
        </div>
      </section>

      <section 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ color: 'var(--accent-blue)' }} />
          {t('wallet.about.title', 'About Chips')}
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.about.description', 'Chips are used for playing poker. When you join a table, chips are reserved for your buy-in. When you leave, your remaining chips return to your wallet.')}
        </p>
      </section>

      <section 
        className="relative rounded-2xl p-5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faClockRotateLeft} style={{ color: 'var(--color-text)' }} />
          {t('wallet.history.title', 'Transaction History')}
        </h2>
        <div className="mt-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('wallet.history.comingSoon', 'Transaction history coming soon! For now, check your game history in the Stats page.')}
          </p>
        </div>
      </section>
    </div>
  )
}
