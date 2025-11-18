import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faLanguage, faMoon, faSun, faBell } from '@fortawesome/free-solid-svg-icons'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import LanguageSelector from '../components/LanguageSelector'
import { useTheme } from '../providers/ThemeProvider'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const darkMode = mode === 'dark'
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        icon={<FontAwesomeIcon icon={faGear} />}
      />

      <Card>
        <h2 className="text-section-title text-[color:var(--text-primary)] flex items-center gap-2">
          <FontAwesomeIcon icon={faLanguage} />
          {t('settings.sections.language.title')}
        </h2>
        <p className="mt-1 text-caption text-[color:var(--text-muted)]">
          {t('settings.sections.language.description')}
        </p>
        <div className="mt-4">
          <LanguageSelector />
        </div>
      </Card>

      <Card>
        <h2 className="text-section-title text-[color:var(--text-primary)] flex items-center gap-2">
          <FontAwesomeIcon icon={darkMode ? faMoon : faSun} />
          {t('settings.sections.appearance.title')}
        </h2>
        <p className="mt-1 text-caption text-[color:var(--text-muted)]">
          {t('settings.sections.appearance.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-body font-medium text-[color:var(--text-primary)]">
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
        <h2 className="text-section-title text-[color:var(--text-primary)] flex items-center gap-2">
          <FontAwesomeIcon icon={faBell} />
          {t('settings.sections.notifications.title')}
        </h2>
        <p className="mt-1 text-caption text-[color:var(--text-muted)]">
          {t('settings.sections.notifications.description')}
        </p>
        <label className="mt-4 flex items-center gap-3 text-body font-medium text-[color:var(--text-primary)]">
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
