import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faPlay } from '@fortawesome/free-solid-svg-icons'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'
import Avatar from './ui/Avatar'
import PlaySheet from './layout/PlaySheet'
import AppBackground from './background/AppBackground'
import { cn } from '../utils/cn'
import { useTelegram } from '../hooks/useTelegram'
import { useUserData } from '../providers/UserDataProvider'
import { useLayout } from '../providers/LayoutProvider'
import { formatByCurrency } from '../utils/currency'

const bottomNavKeys = ['home', 'lobby', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export default function MainLayout() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { balance } = useUserData()
  const { showBottomNav } = useLayout()
  const location = useLocation()
  const [isPlaySheetOpen, setIsPlaySheetOpen] = useState(false)

  // Hide header and nav when on Table page for immersive full-screen experience
  const isTablePage = location.pathname.startsWith('/table/')
  const isLobbyPage = location.pathname === '/lobby'

  const displayName = user?.first_name || user?.username || 'Player'
  const formatBalance = (bal: number) => formatByCurrency(bal, 'REAL')

  return (
    <>
      <AppBackground />
      <div
        className={cn(
          'app-shell relative flex h-screen w-screen flex-col overflow-hidden text-[color:var(--color-text)]',
          isLobbyPage && 'app-shell--lobby',
        )}
      >
        {!isTablePage && !isLobbyPage && (
          <header 
            className="sticky top-0 z-30 px-4 py-3"
            style={{
              background: 'var(--glass-bg-elevated)',
              borderBottom: '1px solid var(--glass-border)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
              <Link to="/profile" className="flex items-center gap-2.5">
                <Avatar
                  size="sm"
                  className="relative"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }}
                  showTurnIndicator={false}
                />
              </Link>

              <div className="flex flex-1 items-center justify-between gap-3">
                <Link to="/profile" className="flex flex-col leading-tight min-w-0">
                  <span className="truncate max-w-[120px] font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                    {displayName}
                  </span>
                  <span className="font-medium text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {balance !== null ? formatBalance(balance) : '...'}
                  </span>
                </Link>

                <div className="flex items-center gap-2">
                  <LanguageSelector variant="icon" />
                  <Link
                    to="/settings"
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-95"
                    style={{ 
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--color-text)',
                    }}
                    aria-label={t('menu.settings.label')}
                  >
                    <FontAwesomeIcon icon={faGear} className="text-sm" />
                  </Link>
                </div>
              </div>
            </div>
          </header>
        )}

        <main
          className={cn(
            'relative mx-auto flex w-full flex-1 flex-col',
            isTablePage
              ? 'h-full w-full max-w-none overflow-hidden p-0'
              : 'max-w-4xl overflow-y-auto px-4 pb-24 pt-6',
            isLobbyPage && 'lobby-main',
          )}
        >
          <Outlet />
        </main>

        {showBottomNav && isLobbyPage && (
          <div className="lobby-mini-nav" role="navigation" aria-label={t('nav.quick', 'Quick navigation')}>
            {bottomNavItems
              .filter((item) => item.key !== 'lobby')
              .map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) =>
                    cn('lobby-mini-nav__item', isActive && 'is-active')
                  }
                  aria-label={t(item.labelKey)}
                >
                  {({ isActive }) => (
                    <span className={cn('lobby-mini-nav__icon', isActive && 'is-active')}>
                      <FontAwesomeIcon icon={item.icon} />
                    </span>
                  )}
                </NavLink>
              ))}
            <button
              type="button"
              onClick={() => setIsPlaySheetOpen(true)}
              className="lobby-mini-nav__item"
              aria-label={t('nav.play', 'Play')}
            >
              <span className="lobby-mini-nav__icon is-play">
                <FontAwesomeIcon icon={faPlay} />
              </span>
            </button>
          </div>
        )}

        {showBottomNav && !isTablePage && (
          <nav 
            className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe pt-3"
            style={{ 
              height: '72px',
              background: 'var(--glass-bg-elevated)',
              borderTop: '1px solid var(--glass-border)',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
          <div className="relative mx-auto flex w-full max-w-4xl items-center justify-around">
            {bottomNavItems.slice(0, 2).map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.key === 'home'}
                className={({ isActive }) => cn('flex flex-col items-center gap-1', isActive && 'is-active')}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95',
                        isActive && 'bg-gradient-to-br from-[var(--color-accent-start)] to-[var(--color-accent-end)]'
                      )}
                    >
                      <FontAwesomeIcon 
                        icon={item.icon} 
                        style={{ color: isActive ? '#ffffff' : 'var(--color-text-muted)' }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                      }}
                    >
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
            
            <button
              onClick={() => setIsPlaySheetOpen(true)}
              className="flex flex-col items-center gap-1 transition-transform active:scale-95"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent-start)] to-[var(--color-accent-end)] shadow-lg"
              >
                <FontAwesomeIcon icon={faPlay} className="text-white text-lg" />
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                {t('nav.play', 'Play')}
              </span>
            </button>

            {bottomNavItems.slice(2).map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) => cn('flex flex-col items-center gap-1', isActive && 'is-active')}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95',
                        isActive && 'bg-gradient-to-br from-[var(--color-accent-start)] to-[var(--color-accent-end)]'
                      )}
                    >
                      <FontAwesomeIcon 
                        icon={item.icon} 
                        style={{ color: isActive ? '#ffffff' : 'var(--color-text-muted)' }}
                      />
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                      }}
                    >
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
        )}
      </div>

      <PlaySheet isOpen={isPlaySheetOpen} onClose={() => setIsPlaySheetOpen(false)} />
    </>
  )
}
