import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../../hooks/useTelegram'
import { useUserData } from '../../providers/UserDataProvider'
import { formatMoney, formatPlayMoney } from '../../utils/currency'
import { useLocalization } from '../../providers/LocalizationProvider'
import type { ConnectionState } from '../../types/normalized'
import { cn } from '../../utils/cn'

interface LobbyHeaderProps {
  connectionState: ConnectionState
  isOffline?: boolean
}

const STATUS_CLASS_MAP: Record<'online' | 'connecting' | 'offline', string> = {
  online: 'is-online',
  connecting: 'is-connecting',
  offline: 'is-offline',
}

export default function LobbyHeader({ connectionState, isOffline = false }: LobbyHeaderProps) {
  const { t } = useTranslation()
  const { ready } = useTelegram()
  const { balanceReal, balancePlay, preferredCurrency } = useUserData()
  const { language } = useLocalization()
  const [isExpanded, setIsExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const resolvedCurrency = preferredCurrency ?? 'REAL'
  const resolvedBalance = resolvedCurrency === 'PLAY' ? balancePlay : balanceReal
  const balanceLabel =
    resolvedBalance === null
      ? '--'
      : resolvedCurrency === 'PLAY'
        ? formatPlayMoney(resolvedBalance, false)
        : formatMoney(resolvedBalance).replace(/^\$/, '')

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

  const statusTone = useMemo(() => {
    if (isOffline || connectionState === 'disconnected' || connectionState === 'version_mismatch') {
      return 'offline'
    }
    if (!ready || connectionState === 'connecting' || connectionState === 'syncing_snapshot') {
      return 'connecting'
    }
    return 'online'
  }, [connectionState, isOffline, ready])

  return (
    <div className="lobby-status" ref={panelRef}>
      <header className="lobby-status__bar">
        <span
          className={cn(
            'lobby-status__dot',
            STATUS_CLASS_MAP[statusTone],
            statusTone === 'connecting' && 'is-pulsing',
          )}
          aria-hidden="true"
        />

        <Link
          to="/wallet"
          className="lobby-status__wallet"
          aria-label={t('menu.wallet.label', 'Wallet')}
        >
          <FontAwesomeIcon icon={faCoins} className="lobby-status__wallet-icon" />
          <span className="lobby-status__wallet-text ui-nowrap">{balanceLabel}</span>
        </Link>

        <button
          type="button"
          className="lobby-status__menu-btn"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-haspopup="menu"
          aria-label={t('lobbyNew.header.openMenu', 'Open menu')}
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </button>
      </header>

      {isExpanded && (
        <div className="lobby-status__menu" role="menu">
          <Link
            to="/profile"
            className="lobby-status__menu-item"
            role="menuitem"
            onClick={() => setIsExpanded(false)}
          >
            <span className="ui-nowrap">{t('menu.settings.label', 'Settings')}</span>
          </Link>
          <div
            className="lobby-status__menu-item lobby-status__menu-item--static"
            aria-disabled="true"
            title={t('profile.settings.language', 'Language')}
          >
            <span className="ui-nowrap">{t('settings.sections.language.title', 'Language')}</span>
            <span className="lobby-status__menu-meta ui-nowrap">{language.toUpperCase()}</span>
          </div>
          <Link
            to="/profile#help"
            className="lobby-status__menu-item"
            role="menuitem"
            onClick={() => setIsExpanded(false)}
          >
            <span className="ui-nowrap">{t('profile.settings.help', 'Help & Support')}</span>
          </Link>
        </div>
      )}
    </div>
  )
}
