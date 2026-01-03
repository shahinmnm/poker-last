import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'

import Avatar from '../ui/Avatar'
import { useTelegram } from '../../hooks/useTelegram'
import { useUserData } from '../../providers/UserDataProvider'
import { formatByCurrency } from '../../utils/currency'
import { useLocalization } from '../../providers/LocalizationProvider'

interface LobbyHeaderProps {
  statusLabel?: string
}

export default function LobbyHeader({ statusLabel }: LobbyHeaderProps) {
  const { t } = useTranslation()
  const { user, ready } = useTelegram()
  const { balance } = useUserData()
  const { language, supported, changeLanguage } = useLocalization()

  const displayName = user?.first_name || user?.username || t('profile.title', 'Profile')
  const balanceLabel =
    balance === null ? t('common.loading', 'Loading...') : formatByCurrency(balance, 'REAL')
  const currentIndex = supported.findIndex((lang) => lang.code === language)
  const nextLanguage = supported[(currentIndex + 1) % supported.length]

  return (
    <div className="lobby-header">
      <div className="lobby-header__bar">
        <Link to="/profile" className="lobby-header__identity">
          <Avatar size="sm" showTurnIndicator={false} className="lobby-header__avatar" />
          <div className="min-w-0 leading-tight">
            <p className="lobby-header__name" dir="auto">
              {displayName}
            </p>
            <p className="lobby-header__balance tabular-nums">{balanceLabel}</p>
          </div>
        </Link>

        {statusLabel && (
          <div className="lobby-header__status">
            <span className="lobby-header__status-dot" aria-hidden="true" />
            <span className="lobby-header__status-label" dir="auto">
              {statusLabel}
            </span>
            {ready && (
              <span className="lobby-header__status-label lobby-header__status-label--secondary">
                {t('common.status.online', 'Online')}
              </span>
            )}
          </div>
        )}

        <div className="lobby-header__actions">
          <button
            type="button"
            onClick={() => changeLanguage(nextLanguage.code)}
            className="group inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
            aria-label={t('settings.sections.language.title', 'Language')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-semibold text-[var(--text-2)] transition group-active:scale-95">
              {language.toUpperCase()}
            </span>
          </button>
          <Link
            to="/settings"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
            aria-label={t('menu.settings.label', 'Settings')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-2)] transition active:scale-95">
              <FontAwesomeIcon icon={faGear} className="text-[11px]" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
