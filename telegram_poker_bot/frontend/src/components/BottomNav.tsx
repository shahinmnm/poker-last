import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { menuTree } from '../config/menu'
import { cn } from '../utils/cn'
import { HomeLineIcon, LobbyIcon, PlusIcon, WalletIcon, UserIcon } from './ui/icons'

const bottomNavKeys = ['home', 'lobby', 'createGame', 'wallet', 'profile'] as const

const iconMap = {
  home: HomeLineIcon,
  lobby: LobbyIcon,
  createGame: PlusIcon,
  wallet: WalletIcon,
  profile: UserIcon,
}

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mb-3 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="mx-auto flex max-w-4xl items-center justify-center rounded-[24px] border border-[color:var(--color-nav-border)] bg-[color:var(--color-nav-bg)] px-3 py-2 shadow-[var(--shadow-nav)] backdrop-blur-[22px]">
        <div className="grid w-full grid-cols-5 gap-1">
          {bottomNavItems.map((item) => {
            const Icon = iconMap[item.key as keyof typeof iconMap]
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.key === 'home'}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-[11px] font-medium leading-tight text-[color:var(--color-text-muted)] transition-colors duration-150',
                    isActive && 'text-[color:var(--color-text)]',
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        'relative flex h-11 w-full items-center justify-center rounded-[16px] border border-transparent text-[color:var(--color-text-muted)] shadow-[0_-1px_0_rgba(255,255,255,0.04)] transition duration-150',
                        isActive &&
                          'border-white/10 bg-[rgba(34,242,239,0.08)] text-[color:var(--color-accent)] shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm',
                      )}
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="text-[11px] text-current">{t(item.labelKey)}</span>
                    <span
                      className={cn(
                        'h-[3px] w-8 rounded-full bg-transparent transition',
                        isActive && 'bg-[radial-gradient(circle_at_center,rgba(34,242,239,0.9),transparent_65%)]',
                      )}
                    />
                  </div>
                )}
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default BottomNav
