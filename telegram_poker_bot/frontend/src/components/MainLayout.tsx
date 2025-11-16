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
          <div className="app-card app-card--overlay flex items-center justify-between rounded-[var(--radius-xl)] px-[var(--space-lg)] py-[var(--space-sm)] sm:px-[calc(var(--space-lg)+var(--space-xs))] sm:py-[calc(var(--space-sm)+var(--space-xs))]">
            {/* Left: Player Info */}
            <Link to="/profile" className="flex items-center gap-[var(--space-md)]">
              <Avatar size="sm" />
              <div className="flex flex-col gap-[var(--space-xs)] leading-tight">
                <span className="text-[13px] font-semibold sm:text-[var(--font-size-base)]">{displayName}</span>
                <span className="text-[var(--font-size-xs)] text-[color:var(--color-text-muted)] sm:text-[11px]">
                  {balance !== null ? `${balance.toLocaleString()} chips` : '...'}
                </span>
              </div>
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-[var(--space-sm)]">
              {hasActiveTables && (
                <Link
                  to={`/table/${activeTables[0].table_id}`}
                  className="app-button app-button--primary app-button--sm flex items-center gap-[calc(var(--space-xs)+var(--space-xs))] text-[var(--font-size-sm)]"
                  title={t('home.actions.resumeGame')}
                >
                  <span>▶</span>
                  <span className="hidden sm:inline">{t('home.actions.resume')}</span>
                </Link>
              )}
              <LanguageSelector />
              <Link
                to="/settings"
                className="app-button app-button--secondary app-button--md flex h-8 w-8 items-center justify-center !px-0 text-[var(--font-size-base)]"
                aria-label={t('menu.settings.label')}
              >
                ⚙️
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-[var(--space-lg)] pb-24 pt-[var(--space-lg)] sm:px-[var(--space-xl)] sm:pt-[var(--space-xl)]">
        <Outlet />
      </main>
      <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-[var(--space-md)] pb-[calc(var(--space-sm)+var(--space-xs))] pt-[calc(var(--space-xs)+var(--space-xs))] sm:px-[var(--space-lg)]">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around gap-[var(--space-xs)]">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key === 'home'}
              className={({ isActive }) =>
                cn('app-bottom-nav__link text-[11px] sm:text-[var(--font-size-sm)]', isActive && 'is-active')
              }
            >
              <span className="text-[var(--font-size-base)] sm:text-base">{item.icon}</span>
              <span className="leading-tight">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
