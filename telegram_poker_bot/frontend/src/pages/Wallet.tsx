import { Component, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faShield, faShuffle } from '@fortawesome/free-solid-svg-icons'

import { useUserData } from '../providers/UserDataProvider'
import { CurrencyType, formatMoney, formatPlayMoney } from '../utils/currency'
import TransactionHistory from '@/components/wallet/TransactionHistory'

type WalletCurrency = CurrencyType

class WalletErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, info: any) {
    // Surface errors instead of a black screen
    console.error('Wallet page crashed', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="poker-panel flex min-h-[40vh] items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Something went wrong loading Wallet. Please refresh.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function WalletPageInner() {
  const { t } = useTranslation()
  const { balances, balanceReal, balancePlay, loading, preferredCurrency, setPreferredCurrency } = useUserData()
  const activeCurrency = preferredCurrency

  const selectedBalance = useMemo(() => {
    if (activeCurrency === 'REAL') return balanceReal ?? 0
    return balancePlay ?? 0
  }, [activeCurrency, balancePlay, balanceReal])

  const formattedSelected =
    activeCurrency === 'REAL' ? formatMoney(selectedBalance) : formatPlayMoney(selectedBalance, false)

  if (loading || !balances) {
    return (
      <div
        className="wallet-panel flex min-h-[40vh] items-center justify-center"
      >
        <p className="text-sm ui-muted">
          {t('common.loading')}
        </p>
      </div>
    )
  }

  const cards = [
    {
      key: 'REAL' as WalletCurrency,
      title: 'Real Money',
      accent: 'linear-gradient(135deg, rgba(30, 198, 120, 0.3), rgba(8, 16, 12, 0.98))',
      border: 'rgba(30, 198, 120, 0.4)',
      glow: '0 20px 45px rgba(0, 0, 0, 0.45)',
      textColor: '#f5f1eb',
      icon: '$',
      balance: formatMoney(balanceReal ?? 0),
      sub: 'USD chips • 1 chip = 1¢',
    },
    {
      key: 'PLAY' as WalletCurrency,
      title: 'Play Money',
      accent: 'linear-gradient(140deg, rgba(75, 148, 255, 0.3), rgba(8, 16, 12, 0.98))',
      border: 'rgba(75, 148, 255, 0.4)',
      glow: '0 20px 50px rgba(16, 36, 72, 0.4)',
      textColor: '#e7eefc',
      icon: '💎',
      balance: formatPlayMoney(balancePlay ?? 0, false),
      sub: 'Practice chips • 1 chip = 1 point',
    },
  ]

  const helperPills = [
    { icon: faShield, label: 'Secured balances & ledger' },
    { icon: faShuffle, label: 'Separate REAL vs PLAY tables' },
    { icon: faBolt, label: 'Instant buy-ins & cash-outs' },
  ]

  return (
    <div className="space-y-6 page-stack">
      <div className="wallet-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('wallet.title', 'Wallet')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.subtitle', 'Dual balances for real and play chips')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {helperPills.map((pill) => (
              <span
                key={pill.label}
                className="poker-tile hidden md:inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[color:var(--color-text-muted)]"
              >
                <FontAwesomeIcon icon={pill.icon} className="text-[11px]" />
                {pill.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="wallet-panel p-5 space-y-4" id="balance">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.balance', 'Balance')}
        </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const isActive = activeCurrency === card.key
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => void setPreferredCurrency(card.key)}
              className="wallet-panel w-full p-5 text-left transition-transform active:scale-[0.99] focus:outline-none"
              style={{
                background: card.accent,
                border: `1px solid ${card.border}`,
                boxShadow: isActive ? card.glow : 'none',
                transform: isActive ? 'translateY(-4px)' : 'translateY(0)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: card.textColor,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {card.icon}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: card.textColor }}>
                      {card.title}
                    </p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {card.sub}
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                    color: card.textColor,
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {isActive ? 'Selected' : 'Switch'}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('wallet.balance', 'Balance')}
                </p>
                <p className="text-3xl font-semibold leading-tight" style={{ color: card.textColor }}>
                  {card.balance}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="poker-panel poker-panel--elevated p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.balance', 'Balance')}
            </p>
            <p className="text-4xl font-bold" style={{ color: 'var(--color-text)' }}>
              {formattedSelected}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {activeCurrency === 'REAL' ? '$1.00 = 100 chips' : 'Chips for practice tables'}
            </p>
          </div>
          <div className="poker-tile poker-tile--flat inline-flex gap-2 rounded-full p-1">
            <button
              type="button"
              onClick={() => void setPreferredCurrency('REAL')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                activeCurrency === 'REAL' ? 'shadow-[0_10px_25px_rgba(0,0,0,0.25)]' : ''
              }`}
              style={{
                background: activeCurrency === 'REAL' ? 'var(--glass-bg-elevated)' : 'transparent',
                color: activeCurrency === 'REAL' ? 'var(--color-text)' : 'var(--color-text-muted)',
                border: '1px solid var(--glass-border)',
              }}
            >
              Real Money
            </button>
            <button
              type="button"
              onClick={() => void setPreferredCurrency('PLAY')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                activeCurrency === 'PLAY' ? 'shadow-[0_10px_25px_rgba(0,0,0,0.25)]' : ''
              }`}
              style={{
                background: activeCurrency === 'PLAY' ? 'var(--glass-bg-elevated)' : 'transparent',
                color: activeCurrency === 'PLAY' ? 'var(--color-text)' : 'var(--color-text-muted)',
                border: '1px solid var(--glass-border)',
              }}
            >
              Play Money
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="poker-tile poker-tile--flat p-4">
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.about.title', 'About Chips')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text)' }}>
              1 chip = 1 cent. All bets and pots are tracked in whole chips for engine accuracy.
            </p>
          </div>
          <div className="poker-tile poker-tile--flat p-4">
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.actions.topUp', 'Buy-ins')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text)' }}>
              Use the selected wallet when joining a table. Funds lock in before seating and return when you leave.
            </p>
          </div>
          <div className="poker-tile poker-tile--flat p-4">
            <p className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
              {t('wallet.transactions.title', 'Ledger')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text)' }}>
              Every buy-in, cash-out, win, and rake is logged with its currency type for auditability.
            </p>
          </div>
        </div>
      </div>

      </section>

      <section className="poker-panel p-4" id="history">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.sections.recentTransactions', 'Recent Transactions')}
        </h3>
        <TransactionHistory />
      </section>

      <section className="wallet-panel p-5 space-y-2" id="deposit">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.actions.deposit', 'Deposit')}
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.sections.depositHint', 'Deposits are handled in the Telegram bot menu.')}
        </p>
      </section>

      <section className="wallet-panel p-5 space-y-2" id="withdraw">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('wallet.actions.withdraw', 'Withdraw')}
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('wallet.sections.withdrawHint', 'Withdrawals are handled in the Telegram bot menu.')}
        </p>
      </section>
    </div>
  )
}

export default function WalletPage() {
  return (
    <WalletErrorBoundary>
      <WalletPageInner />
    </WalletErrorBoundary>
  )
}
