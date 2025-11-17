import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'
import Avatar from './ui/Avatar'
import { cn } from '../utils/cn'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

const bottomNavKeys = ['home', 'lobby', 'createGame', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export default function MainLayout() {
  const { t } = useTranslation()
  const { user, initData } = useTelegram()
  const [balance, setBalance] = useState<number | null>(null)
  const [activeTables, setActiveTables] = useState<any[]>([])

  useEffect(() => {
    if (!initData) return

    // Fetch balance and active tables
    Promise.all([
      apiFetch<{ balance: number }>('/users/me/balance', { initData }).catch(() => ({ balance: 0 })),
      apiFetch<{ tables: any[] }>('/users/me/tables', { initData }).catch(() => ({ tables: [] })),
    ]).then(([balanceData, tablesData]) => {
      setBalance(balanceData.balance)
      setActiveTables(tablesData.tables || [])
    })
  }, [initData])

  const displayName = user?.first_name || user?.username || 'Player'
  const hasActiveTables = activeTables.length > 0

  return (
    <div className="relative flex min-h-screen flex-col text-[color:var(--color-text)]">
      <header className="sticky top-0 z-30 px-[var(--space-lg)] pt-[var(--space-sm)] sm:px-[var(--space-xl)]">
        <div className="mx-auto w-full max-w-4xl">
          <div className="glass-panel flex h-[56px] items-center gap-3 px-4 shadow-[0_18px_46px_rgba(0,0,0,0.55)]" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-sm) var(--space-md)' }}>
            <Link to="/profile" className="relative flex items-center gap-3">
              <span className="absolute inset-[-4px] rounded-full bg-[rgba(44,197,122,0.45)] blur-md" aria-hidden />
              <Avatar size="sm" className="relative h-9 w-9 border border-white/30" />
            </Link>

            <div className="flex flex-1 items-center justify-between gap-3">
              <Link to="/profile" className="flex flex-1 flex-col leading-tight">
                <span className="font-semibold" style={{ fontSize: 'var(--fs-large)', color: 'var(--text-strong)' }}>{displayName}</span>
                <span className="font-medium" style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  {balance !== null ? `${balance.toLocaleString()} chips` : '...'}
                </span>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  to={hasActiveTables ? `/table/${activeTables[0].table_id}` : '/lobby'}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--color-accent-start)] to-[color:var(--color-accent-end)] text-white shadow-[0_0_18px_rgba(44,197,122,0.55)] transition-transform duration-150 ease-out active:scale-95 border border-white/30"
                  aria-label={hasActiveTables ? t('home.actions.resumeGame') : t('menu.lobby.label')}
                >
                  ▶
                </Link>
                <LanguageSelector variant="icon" />
                <Link
                  to="/settings"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-[color:var(--text-strong)] transition-transform duration-150 ease-out active:scale-95 border border-white/30"
                  aria-label={t('menu.settings.label')}
                >
                  ⚙️
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-[var(--space-lg)] pb-24 pt-[var(--space-lg)] sm:px-[var(--space-xl)] sm:pt-[var(--space-xl)]">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 px-[var(--space-md)] pb-[calc(var(--space-sm)+var(--space-xs))] pt-[calc(var(--space-xs)+var(--space-xs))] sm:px-[var(--space-lg)]" style={{ height: '60px', background: 'var(--surface-elevated)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-nav)' }}>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around gap-[var(--space-xs)]">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key === 'home'}
              className={({ isActive }) => cn('flex flex-col items-center gap-1 text-[11px] sm:text-[var(--font-size-sm)]', isActive && 'is-active')}
            >
              {({ isActive }) => (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full bg-transparent transition-all duration-150 ease-out active:scale-95',
                      isActive && 'border-2 border-[color:var(--accent-main)] shadow-[0_0_12px_rgba(44,197,122,0.6)]',
                    )}
                    style={{ fontSize: 'var(--fs-large)' }}
                  >
                    <span style={{ color: isActive ? 'var(--accent-main)' : 'var(--text-muted)' }}>{item.icon}</span>
                  </div>
                  <span
                    className="leading-tight"
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: isActive ? 'var(--accent-main)' : 'var(--text-muted)',
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
