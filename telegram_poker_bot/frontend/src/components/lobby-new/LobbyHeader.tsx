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
    <header className="lobby-header-v2">
      <Link to="/profile" className="lobby-header-v2__identity">
        <Avatar size="sm" showTurnIndicator={false} className="lobby-header-v2__avatar" />
        <div className="lobby-header-v2__user">
          <span className="lobby-header-v2__name">{displayName}</span>
          <span className="lobby-header-v2__balance">{balanceLabel}</span>
        </div>
      </Link>

      <div className="lobby-header-v2__center">
        <span className="lobby-header-v2__dot" aria-hidden="true" />
        <span className="lobby-header-v2__status">
          {statusLabel || (ready ? t('common.status.online', 'Online') : '')}
        </span>
      </div>

      <div className="lobby-header-v2__actions">
        <button
          type="button"
          onClick={() => changeLanguage(nextLanguage.code)}
          className="lobby-header-v2__icon-btn"
          aria-label={t('settings.sections.language.title', 'Language')}
        >
          <span className="lobby-header-v2__lang">{language.toUpperCase()}</span>
        </button>
        <Link
          to="/settings"
          className="lobby-header-v2__icon-btn"
          aria-label={t('menu.settings.label', 'Settings')}
        >
          <FontAwesomeIcon icon={faGear} className="lobby-header-v2__gear" />
        </Link>
      </div>
    </header>
  )
}
