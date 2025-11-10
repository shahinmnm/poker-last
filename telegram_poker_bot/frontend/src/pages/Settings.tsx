import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import LanguageSelector from '../components/LanguageSelector'
import { useTheme } from '../providers/ThemeProvider'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const darkMode = mode === 'dark'
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      </header>

      <section id="language" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('settings.sections.language.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t('settings.sections.language.description')}
        </p>
        <div className="mt-4">
          <LanguageSelector />
        </div>
      </section>

      <section id="preferences" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('settings.sections.appearance.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t('settings.sections.appearance.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(event) => setMode(event.target.checked ? 'dark' : 'light')}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
            />
          {t('settings.toggles.darkMode')}
        </label>
      </section>

      <section id="notifications" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('settings.sections.notifications.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t('settings.sections.notifications.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(event) => setNotifications(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
          />
          {t('settings.toggles.notifications')}
        </label>
      </section>

      <button
        type="button"
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        {t('settings.actions.save')}
      </button>
    </div>
  )
}
