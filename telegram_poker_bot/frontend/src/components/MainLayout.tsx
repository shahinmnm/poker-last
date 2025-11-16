import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'
import { cn } from '../utils/cn'

const bottomNavKeys = ['home', 'lobby', 'createGame', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export default function MainLayout() {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-screen flex-col text-[color:var(--text-primary)]">
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <div className="app-card app-card--overlay flex items-center justify-between rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3">
            <Link to="/" className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold sm:text-base">{t('app.title')}</span>
              <span className="text-[10px] text-[color:var(--text-muted)] sm:text-xs">{t('app.subtitle')}</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <Link
                to="/settings"
                className="app-button app-button--secondary app-button--md flex h-8 w-8 items-center justify-center !px-0 text-base"
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
              <span className="text-base">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
