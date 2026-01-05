import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'
import Avatar from './ui/Avatar'
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
  const { user, ready } = useTelegram()
  const { balanceReal, balancePlay, preferredCurrency } = useUserData()
  const { showBottomNav } = useLayout()
  const location = useLocation()

  // Hide header and nav when on Table page for immersive full-screen experience
  const isTablePage = location.pathname.startsWith('/table/')
  const isLobbyPage = location.pathname.startsWith('/lobby')
  const isHomePage = location.pathname === '/'
  const showBottomBar = showBottomNav && !isTablePage
  const dockOffset = 'calc(88px + env(safe-area-inset-bottom, 0px))'
  const basePaddingBottom = showBottomBar ? dockOffset : 'calc(48px + env(safe-area-inset-bottom, 0px))'

  const displayName = user?.first_name || user?.username || 'Player'
  const formatBalance = (bal: number) => formatByCurrency(bal, preferredCurrency)
  const displayBalance = preferredCurrency === 'PLAY' ? balancePlay : balanceReal

  const connectionLabel = ready
    ? t('common.status.connected', 'Connected')
    : t('common.status.connecting', 'Connecting')

  return (
    <>
      <AppBackground />
      <div
        className={cn(
          'app-shell ui-shell relative flex h-screen w-screen flex-col overflow-hidden text-[color:var(--color-text)]',
          !isTablePage && !isLobbyPage && !isHomePage && 'app-shell--safe',
          isHomePage && 'app-shell--home',
          isLobbyPage && 'app-shell--lobby',
        )}
      >
        {!isTablePage && !isLobbyPage && !isHomePage && (
          <header className="app-header ui-panel">
            <div className="app-header__content">
              <Link to="/profile" className="app-header__identity">
                <Avatar size="sm" className="app-header__avatar" showTurnIndicator={false} />
                <div className="min-w-0 leading-tight">
                  <span className="app-header__name" dir="auto">
                    {displayName}
                  </span>
                  <span className="app-header__balance">
                    {displayBalance !== null ? formatBalance(displayBalance) : '...'}
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
              : isLobbyPage
                ? 'app-main max-w-none overflow-y-auto px-0 pt-0'
                : isHomePage
                  ? 'app-main max-w-none overflow-y-auto px-0 pt-0'
                  : 'app-main max-w-5xl overflow-y-auto px-4 pt-4',
            isLobbyPage && 'lobby-main',
            isHomePage && 'home-main',
          )}
          style={
            isTablePage
              ? undefined
              : { paddingBottom: basePaddingBottom }
          }
        >
          <Outlet />
        </main>

        {showBottomBar && (
          <nav
            className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-weak)]"
            role="navigation"
            aria-label={t('nav.main', 'Main navigation')}
          >
            <div className="mx-auto flex w-full max-w-none items-center justify-around gap-2 px-3 py-2">
              {bottomNavItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'app-bottom-nav__link',
                      isActive && 'is-active',
                    )
                  }
                  aria-label={t(item.labelKey)}
                >
                  <FontAwesomeIcon icon={item.icon} />
                  <span className="truncate">{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </div>
    </>
  )
}
