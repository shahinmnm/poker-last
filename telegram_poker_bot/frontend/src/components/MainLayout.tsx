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
import FloatingNavPill from './layout/FloatingNavPill'
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
  const { user, ready } = useTelegram()
  const { balance } = useUserData()
  const { showBottomNav } = useLayout()
  const location = useLocation()
  const [isPlaySheetOpen, setIsPlaySheetOpen] = useState(false)

  // Hide header and nav when on Table page for immersive full-screen experience
  const isTablePage = location.pathname.startsWith('/table/')
  const isLobbyPage = location.pathname === '/lobby'
  const showFloatingNav = showBottomNav && !isTablePage

  const displayName = user?.first_name || user?.username || 'Player'
  const formatBalance = (bal: number) => formatByCurrency(bal, 'REAL')

  const connectionLabel = ready
    ? t('common.status.connected', 'Connected')
    : t('common.status.connecting', 'Connecting')

  return (
    <>
      <AppBackground />
      <div
        className={cn(
          'app-shell relative flex h-screen w-screen flex-col overflow-hidden text-[color:var(--color-text)]',
          !isTablePage && 'app-shell--safe',
        )}
      >
        {!isTablePage && !isLobbyPage && (
          <header className="app-header">
            <div className="app-header__content">
              <Link to="/profile" className="app-header__identity">
                <Avatar size="sm" className="app-header__avatar" showTurnIndicator={false} />
                <div className="min-w-0 leading-tight">
                  <span className="app-header__name" dir="auto">
                    {displayName}
                  </span>
                  <span className="app-header__balance">
                    {balance !== null ? formatBalance(balance) : '...'}
                  </span>
                </div>
              </Link>

              <div className="app-header__status" aria-live="polite">
                <span className={cn('app-header__dot', ready ? 'is-online' : 'is-offline')} aria-hidden />
                <span className="app-header__status-label">{connectionLabel}</span>
              </div>

              <div className="app-header__actions">
                <LanguageSelector variant="icon" />
                <Link
                  to="/settings"
                  className="app-header__icon-button"
                  aria-label={t('menu.settings.label')}
                >
                  <FontAwesomeIcon icon={faGear} className="text-sm" />
                </Link>
              </div>
            </div>
          </header>
        )}

        <main
          className={cn(
            'relative mx-auto flex w-full flex-1 flex-col',
            isTablePage
              ? 'h-full w-full max-w-none overflow-hidden p-0'
              : 'app-main max-w-4xl overflow-y-auto px-4 pb-24 pt-4',
            isLobbyPage && 'lobby-main',
          )}
        >
          <Outlet />
        </main>

        {showFloatingNav && <FloatingNavPill items={bottomNavItems} />}

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
