import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faArrowUp, faArrowDown, faTicket } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

export default function WalletPage() {
  const { t } = useTranslation()
  const { initData } = useTelegram()
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [promoCode, setPromoCode] = useState('')

  useEffect(() => {
    const fetchBalance = async () => {
      if (!initData) return

      try {
        setLoading(true)
        const balanceData = await apiFetch<{ balance: number }>('/users/me/balance', { initData })
        setBalance(balanceData.balance)
      } catch (err) {
        console.error('Error fetching balance:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [initData])

  const formatBalance = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount.toLocaleString()
  }

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center rounded-2xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {t('wallet.title', 'Wallet')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('wallet.subtitle', 'Manage your chip balance')}
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-6"
        style={{
          background: 'var(--glass-bg-elevated)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <FontAwesomeIcon icon={faCoins} className="text-xl" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.balance', 'Balance')}
            </p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {formatBalance(balance)}
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.activity.title', 'Recent activity')}
        </h3>
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('wallet.activity.empty', 'No transactions yet')}
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.about.title', 'About Chips')}
        </h3>
        <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <li>• {t('wallet.about.point1', 'Used for table buy-ins')}</li>
          <li>• {t('wallet.about.point2', 'Returned when you leave')}</li>
          <li>• {t('wallet.about.point3', 'Track in game history')}</li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled
          className="rounded-xl px-4 py-3 text-sm font-semibold transition-transform active:scale-98 opacity-50 cursor-not-allowed"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text)',
          }}
        >
          <FontAwesomeIcon icon={faArrowUp} className="mr-2" />
          {t('wallet.actions.topUp', 'Top up')}
        </button>
        <button
          disabled
          className="rounded-xl px-4 py-3 text-sm font-semibold transition-transform active:scale-98 opacity-50 cursor-not-allowed"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text)',
          }}
        >
          <FontAwesomeIcon icon={faArrowDown} className="mr-2" />
          {t('wallet.actions.withdraw', 'Withdraw')}
        </button>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          <FontAwesomeIcon icon={faTicket} className="mr-2" />
          {t('wallet.promo.label', 'Promo code')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder={t('wallet.promo.placeholder', 'Enter code')}
            className="flex-1 rounded-xl px-4 py-3 text-sm uppercase tracking-wider"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            disabled
            className="rounded-xl px-6 py-3 font-semibold opacity-50 cursor-not-allowed"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          >
            {t('wallet.promo.redeem', 'Redeem')}
          </button>
        </div>
      </div>
    </div>
  )
}
