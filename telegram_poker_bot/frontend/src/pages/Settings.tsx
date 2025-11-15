import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LanguageSelector from '../components/LanguageSelector'
import { useTheme } from '../providers/ThemeProvider'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const darkMode = mode === 'dark'
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">
          {t('settings.title')}
        </h1>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          {t('settings.sections.language.title')}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {t('settings.sections.language.description')}
        </p>
        <div className="mt-4">
          <LanguageSelector />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          {t('settings.sections.appearance.title')}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {t('settings.sections.appearance.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[color:var(--text-primary)]">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(event) => setMode(event.target.checked ? 'dark' : 'light')}
            className="h-4 w-4 rounded border-[color:var(--surface-border)] text-[color:var(--accent-start)] focus:ring-[color:var(--accent-start)]"
          />
          {t('settings.toggles.darkMode')}
        </label>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          {t('settings.sections.notifications.title')}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {t('settings.sections.notifications.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-[color:var(--text-primary)]">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(event) => setNotifications(event.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--surface-border)] text-[color:var(--accent-start)] focus:ring-[color:var(--accent-start)]"
          />
          {t('settings.toggles.notifications')}
        </label>
      </Card>

      <Button block size="lg">
        {t('settings.actions.save')}
      </Button>
    </div>
  )
}
