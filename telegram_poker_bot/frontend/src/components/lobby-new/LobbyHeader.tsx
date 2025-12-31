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
    <div className="flex h-11 items-center justify-between gap-2 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] px-3 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      <Link
        to="/profile"
        className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-2 py-1"
      >
        <Avatar size="sm" showTurnIndicator={false} />
        <div className="min-w-0 leading-tight">
          <p
            className="truncate text-[clamp(13px,1.8vw,15px)] font-semibold text-[var(--text-1)]"
            dir="auto"
          >
            {displayName}
          </p>
          <p className="text-[clamp(11px,1.5vw,12px)] text-[var(--text-3)] tabular-nums">
            {balanceLabel}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => changeLanguage(nextLanguage.code)}
          className="group inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
          aria-label={t('settings.sections.language.title', 'Language')}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] text-[10px] font-semibold text-[var(--text-2)] transition group-active:scale-95">
            {language.toUpperCase()}
          </span>
        </button>
        <Link
          to="/settings"
          className="group inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
          aria-label={t('menu.settings.label', 'Settings')}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] text-[var(--text-2)] transition group-active:scale-95">
            <FontAwesomeIcon icon={faGear} className="text-[12px]" />
          </span>
        </Link>
      </div>
    </div>
  )
}
