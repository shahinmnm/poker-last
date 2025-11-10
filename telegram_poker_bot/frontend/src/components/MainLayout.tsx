import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { menuTree } from '../config/menu'
import LanguageSelector from './LanguageSelector'

const bottomNavKeys = ['home', 'lobby', 'createGame', 'wallet', 'profile'] as const

const bottomNavItems = bottomNavKeys
  .map((key) => menuTree.find((item) => item.key === key))
  .filter((value): value is NonNullable<typeof value> => Boolean(value))

export default function MainLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex flex-col">
            <span className="text-base font-semibold sm:text-lg">{t('app.title')}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{t('app.subtitle')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-lg hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              aria-label={t('menu.settings.label')}
            >
              ⚙️
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-4 sm:pb-28 sm:pt-6">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-around px-2 py-2">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key === 'home'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center rounded-md px-3 py-2 text-xs transition sm:text-sm',
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100',
                ].join(' ')
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
