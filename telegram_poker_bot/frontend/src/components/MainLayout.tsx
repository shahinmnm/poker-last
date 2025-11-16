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
    <div className="relative flex min-h-screen flex-col text-[color:var(--text-primary)]">
      <header className="sticky top-0 z-30 px-4 pt-2 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <div className="app-card app-card--overlay flex items-center justify-between rounded-2xl px-4 py-2 sm:px-5 sm:py-2.5">
            {/* Left: Player Info */}
            <Link to="/profile" className="flex items-center gap-3">
              <Avatar size="sm" />
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-[13px] font-semibold sm:text-sm">{displayName}</span>
                <span className="text-[10px] text-[color:var(--text-muted)] sm:text-[11px]">
                  {balance !== null ? `${balance.toLocaleString()} chips` : '...'}
                </span>
              </div>
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {hasActiveTables && (
                <Link
                  to={`/table/${activeTables[0].table_id}`}
                  className="app-button app-button--primary app-button--sm flex items-center gap-1.5 text-xs"
                  title={t('home.actions.resumeGame')}
                >
                  <span>▶</span>
                  <span className="hidden sm:inline">{t('home.actions.resume')}</span>
                </Link>
              )}
              <LanguageSelector />
              <Link
                to="/settings"
                className="app-button app-button--secondary app-button--md flex h-8 w-8 items-center justify-center !px-0 text-sm"
                aria-label={t('menu.settings.label')}
              >
                ⚙️
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
        <Outlet />
      </main>
      <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-3 pb-2.5 pt-1.5 sm:px-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around gap-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key === 'home'}
              className={({ isActive }) =>
                cn('app-bottom-nav__link text-[11px] sm:text-xs', isActive && 'is-active')
              }
            >
              <span className="text-sm sm:text-base">{item.icon}</span>
              <span className="leading-tight">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
