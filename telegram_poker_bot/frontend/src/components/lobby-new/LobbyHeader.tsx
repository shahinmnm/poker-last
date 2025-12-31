import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'

import Avatar from '../ui/Avatar'
import { useTelegram } from '../../hooks/useTelegram'
import { useUserData } from '../../providers/UserDataProvider'
import { formatByCurrency } from '../../utils/currency'
import { useLocalization } from '../../providers/LocalizationProvider'

export default function LobbyHeader() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { balance } = useUserData()
  const { language, supported, changeLanguage } = useLocalization()

  const displayName = user?.first_name || user?.username || t('profile.title', 'Profile')
  const balanceLabel =
    balance === null ? t('common.loading', 'Loading...') : formatByCurrency(balance, 'REAL')
  const currentIndex = supported.findIndex((lang) => lang.code === language)
  const nextLanguage = supported[(currentIndex + 1) % supported.length]

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
      <Link to="/profile" className="flex min-w-0 items-center gap-3">
        <Avatar size="sm" showTurnIndicator={false} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-1)]" dir="auto">
            {displayName}
          </p>
          <p className="text-xs text-[var(--text-3)] tabular-nums">{balanceLabel}</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => changeLanguage(nextLanguage.code)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-2)] transition hover:text-[var(--text-1)]"
          aria-label={t('settings.sections.language.title', 'Language')}
        >
          {language.toUpperCase()}
        </button>
        <Link
          to="/settings"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-2)] transition hover:text-[var(--text-1)]"
          aria-label={t('menu.settings.label', 'Settings')}
        >
          <FontAwesomeIcon icon={faGear} className="text-sm" />
        </Link>
      </div>
    </div>
  )
}
