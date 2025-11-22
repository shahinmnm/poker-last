import { Link, NavLink, Outlet } from 'react-router-dom'
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

const bottomNavKeys = ['home', 'lobby', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export default function MainLayout() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { balance } = useUserData()
  const { showBottomNav } = useLayout()
  const [isPlaySheetOpen, setIsPlaySheetOpen] = useState(false)

  const displayName = user?.first_name || user?.username || 'Player'
  const formatBalance = (bal: number) => {
    if (bal >= 1000000) return `${(bal / 1000000).toFixed(1)}M`
    if (bal >= 1000) return `${(bal / 1000).toFixed(1)}K`
    return bal.toString()
  }

  return (
    <>
      <AppBackground />
      <div className="relative flex min-h-screen flex-col text-[color:var(--color-text)]">
        <header 
          className="sticky top-0 z-30 px-4 py-3"
          style={{
            background: 'var(--glass-bg-elevated)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            borderBottom: '1px solid var(--glass-border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2.5">
              <Avatar size="sm" className="relative" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
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

        <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-6">
          <Outlet />
        </main>

        {showBottomNav && (
          <nav 
            className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe pt-3"
            style={{ 
              height: '72px',
              background: 'var(--glass-bg-elevated)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
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
