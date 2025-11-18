import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faGear } from '@fortawesome/free-solid-svg-icons'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'
import Avatar from './ui/Avatar'
import SmartActionSlot from './SmartActionSlot'
import { cn } from '../utils/cn'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

const bottomNavKeys = ['home', 'lobby', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

const activeStatuses = ['active', 'waiting', 'paused']

function pickActiveTable(tables: any[]) {
  const now = Date.now()
  const filtered = tables
    .filter((table) => {
      const status = (table?.status || '').toString().toLowerCase()
      if (!activeStatuses.includes(status)) return false
      const expiresAt = table?.expires_at || table?.expiresAt
      if (expiresAt) {
        const expiry = new Date(expiresAt).getTime()
        if (!Number.isNaN(expiry) && expiry < now) return false
      }
      return true
    })
    .sort((a, b) => {
      const aTime = new Date(a?.updated_at || a?.updatedAt || 0).getTime()
      const bTime = new Date(b?.updated_at || b?.updatedAt || 0).getTime()
      return bTime - aTime
    })

  return filtered[0] || null
}

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
  const currentActiveTable = useMemo(() => pickActiveTable(activeTables), [activeTables])

  // Determine smart action slot mode
  const smartActionMode = useMemo(() => {
    if (currentActiveTable) {
      return {
        mode: 'backToTable' as const,
        to: `/table/${currentActiveTable.table_id || currentActiveTable.id}`,
        label: 'Resume',
      }
    }
    // Default to quick seat
    return {
      mode: 'quickSeat' as const,
      to: '/lobby',
      label: 'Quick Seat',
    }
  }, [currentActiveTable])

  return (
    <div className="relative flex min-h-screen flex-col text-[color:var(--color-text)]">
      <header className="sticky top-0 z-30 px-[var(--space-lg)] py-[var(--space-xs)] sm:px-[var(--space-xl)]">
        <div className="mx-auto w-full max-w-4xl">
          <div 
            className="relative flex items-center gap-2.5 px-3 py-2" 
            style={{ 
              borderRadius: 'var(--radius-xl)',
              borderBottomLeftRadius: 'var(--radius-2xl)',
              borderBottomRightRadius: 'var(--radius-2xl)',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--color-border-glass)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Diagonal highlight for glass effect */}
            <div 
              className="absolute top-0 left-[20%] right-[20%] h-[50%] pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent)',
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              }}
            />
            
            <Link to="/profile" className="relative flex items-center gap-2.5 z-10">
              <span 
                className="absolute inset-[-3px] rounded-full blur-md" 
                style={{ background: 'var(--glow-primary)' }}
                aria-hidden 
              />
              <Avatar size="sm" className="relative" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
            </Link>

            <div className="relative flex flex-1 items-center justify-between gap-3 z-10">
              <Link to="/profile" className="flex flex-1 flex-col leading-tight min-w-0">
                <span className="truncate max-w-[120px] font-semibold text-[14px]" style={{ color: 'var(--color-text)' }}>{displayName}</span>
                <span className="font-medium text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {balance !== null ? `${balance.toLocaleString()} chips` : '...'}
                </span>
              </Link>

              <div className="flex items-center gap-2">
                {currentActiveTable && (
                  <Link
                    to={`/table/${currentActiveTable.table_id || currentActiveTable.id}`}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-br from-[color:var(--color-accent-start)] to-[color:var(--color-accent-end)] px-2.5 text-white transition-transform duration-150 ease-out active:scale-95 border border-white/30"
                    style={{ boxShadow: 'var(--shadow-accent-glow)' }}
                    aria-label={t('home.actions.resumeGame')}
                  >
                    <FontAwesomeIcon icon={faPlay} className="text-sm" />
                    <span className="whitespace-nowrap text-[12px] font-medium tracking-wide leading-none">{t('home.actions.resumeGame')}</span>
                  </Link>
                )}
                <LanguageSelector variant="icon" />
                <Link
                  to="/settings"
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-95"
                  style={{ 
                    background: 'var(--bg-glass)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--color-border-glass)',
                    color: 'var(--color-text)',
                  }}
                  aria-label={t('menu.settings.label')}
                >
                  <FontAwesomeIcon icon={faGear} className="text-sm" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-[var(--space-lg)] pb-24 pt-[var(--space-lg)] sm:px-[var(--space-xl)] sm:pt-[var(--space-xl)]">
        <Outlet />
      </main>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 px-[var(--space-md)] pb-[calc(var(--space-sm)+var(--space-xs))] pt-[calc(var(--space-xs)+var(--space-xs))] sm:px-[var(--space-lg)]" 
        style={{ 
          height: '60px',
          background: 'var(--bg-glass)', 
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderTop: '1px solid var(--color-border-glass)', 
          boxShadow: 'var(--shadow-nav)',
          borderTopLeftRadius: 'var(--radius-2xl)',
          borderTopRightRadius: 'var(--radius-2xl)',
        }}
      >
        {/* Diagonal highlight for glass dock */}
        <div 
          className="absolute inset-x-[10%] bottom-[30%] h-[40%] pointer-events-none"
          style={{
            background: 'linear-gradient(0deg, transparent, rgba(255, 255, 255, 0.06))',
            borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
          }}
        />
        
        <div className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-around gap-[var(--space-xs)]">
          {bottomNavItems.slice(0, 2).map((item) => (
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
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95',
                      isActive 
                        ? 'bg-accent border border-white/20' 
                        : 'bg-transparent'
                    )}
                    style={{ 
                      fontSize: 'var(--fs-large)',
                      boxShadow: isActive ? 'var(--shadow-accent-glow)' : 'none',
                    }}
                  >
                    <FontAwesomeIcon 
                      icon={item.icon} 
                      style={{ color: isActive ? '#ffffff' : 'var(--color-text-muted)' }}
                    />
                  </div>
                  <span
                    className="leading-tight"
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: isActive ? 'var(--accent-main)' : 'var(--color-text-muted)',
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
          
          {/* Smart Action Slot - Dynamic Center Tab */}
          <SmartActionSlot
            mode={smartActionMode.mode}
            to={smartActionMode.to}
            label={smartActionMode.label}
          />

          {bottomNavItems.slice(2).map((item) => (
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
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95',
                      isActive 
                        ? 'bg-accent border border-white/20' 
                        : 'bg-transparent'
                    )}
                    style={{ 
                      fontSize: 'var(--fs-large)',
                      boxShadow: isActive ? 'var(--shadow-accent-glow)' : 'none',
                    }}
                  >
                    <FontAwesomeIcon 
                      icon={item.icon} 
                      style={{ color: isActive ? '#ffffff' : 'var(--color-text-muted)' }}
                    />
                  </div>
                  <span
                    className="leading-tight"
                    style={{
                      fontSize: 'var(--fs-caption)',
                      color: isActive ? 'var(--accent-main)' : 'var(--color-text-muted)',
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
