import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faUser, faGlobe, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

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
  const [isExpanded, setIsExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const displayName = user?.first_name || user?.username || t('profile.title', 'Profile')
  const balanceLabel =
    balance === null ? t('common.loading', 'Loading...') : formatByCurrency(balance, 'REAL')
  const currentIndex = supported.findIndex((lang) => lang.code === language)
  const nextLanguage = supported[(currentIndex + 1) % supported.length]

  // Close panel on outside click
  useEffect(() => {
    if (!isExpanded) return
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExpanded(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isExpanded])

  // Format status display - show table count or status
  const statusDisplay = statusLabel || (ready ? t('common.status.online', 'Online') : t('common.loading', 'Loading...'))
  const isNumeric = /^\d+$/.test(statusDisplay)
  const tableCount = isNumeric ? parseInt(statusDisplay, 10) : 0

  return (
    <div className="lobby-header-capsule" ref={panelRef}>
      <header className="lobby-header-v2">
        <Link to="/profile" className="lobby-header-v2__identity">
          <Avatar size="xs" showTurnIndicator={false} className="lobby-header-v2__avatar" />
          <div className="lobby-header-v2__user">
            <span className="lobby-header-v2__name ui-nowrap" dir="auto">{displayName}</span>
            <span className="lobby-header-v2__balance ui-nowrap">{balanceLabel}</span>
          </div>
        </Link>

        <button
          type="button"
          className="lobby-header-v2__center"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={t('lobbyNew.header.togglePanel', 'Toggle panel')}
        >
          <span className="lobby-header-v2__dot" aria-hidden="true" />
          <span className="lobby-header-v2__center-label ui-nowrap">
            {isNumeric
              ? t('lobbyNew.header.tablesCount', '{{count}} Tables', { count: tableCount })
              : statusDisplay}
          </span>
          <FontAwesomeIcon
            icon={isExpanded ? faChevronUp : faChevronDown}
            className="lobby-header-v2__chevron"
          />
        </button>

        <div className="lobby-header-v2__actions">
          <button
            type="button"
            onClick={() => changeLanguage(nextLanguage.code)}
            className="lobby-header-v2__icon-btn"
            aria-label={t('settings.sections.language.title', 'Language')}
          >
            <span className="lobby-header-v2__lang ui-nowrap">{language.toUpperCase()}</span>
          </button>
        </div>
      </header>

      {/* Expandable Panel */}
      {isExpanded && (
        <div className="lobby-header-v2__panel">
          <Link to="/profile" className="lobby-header-v2__panel-item" onClick={() => setIsExpanded(false)}>
            <FontAwesomeIcon icon={faUser} className="lobby-header-v2__panel-icon" />
            <span className="ui-nowrap">{t('menu.profile.label', 'Profile')}</span>
          </Link>
          <button
            type="button"
            className="lobby-header-v2__panel-item"
            onClick={() => {
              changeLanguage(nextLanguage.code)
              setIsExpanded(false)
            }}
          >
            <FontAwesomeIcon icon={faGlobe} className="lobby-header-v2__panel-icon" />
            <span className="ui-nowrap">{t('settings.sections.language.title', 'Language')}: {language.toUpperCase()}</span>
          </button>
          <Link to="/settings" className="lobby-header-v2__panel-item" onClick={() => setIsExpanded(false)}>
            <FontAwesomeIcon icon={faGear} className="lobby-header-v2__panel-icon" />
            <span className="ui-nowrap">{t('menu.settings.label', 'Settings')}</span>
          </Link>
        </div>
      )}
    </div>
  )
}
