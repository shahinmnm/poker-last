import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCirclePlus,
  faDice,
  faCircleQuestion,
  faLock,
  faUser,
  faWallet,
} from '@fortawesome/free-solid-svg-icons'

import Avatar from '../components/ui/Avatar'
import { useTelegram } from '../hooks/useTelegram'
import { useUserData } from '../providers/UserDataProvider'
import { formatByCurrency } from '../utils/currency'

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useTelegram()
  const { balance } = useUserData()

  const displayName = user?.first_name || user?.username || t('profile.title', 'Profile')
  const balanceLabel =
    balance === null ? t('common.loading', 'Loading...') : formatByCurrency(balance, 'REAL')

  return (
    <div className="home-menu">
      <section className="home-menu__identity">
        <Avatar size="sm" className="home-menu__avatar" showTurnIndicator={false} />
        <div className="home-menu__identity-text">
          <span className="home-menu__name ui-nowrap" dir="auto">{displayName}</span>
          <span className="home-menu__balance ui-nowrap">{balanceLabel}</span>
        </div>
      </section>

      <button
        type="button"
        onClick={() => navigate('/lobby')}
        className="home-menu__cta"
      >
        <FontAwesomeIcon icon={faBolt} />
        <span className="ui-nowrap">{t('lobbyNew.quickSeat.button', 'Quick Seat')}</span>
      </button>

      <div className="home-menu__grid home-menu__grid--secondary">
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="home-menu__button"
        >
          <FontAwesomeIcon icon={faDice} />
          <span className="ui-nowrap">{t('menu.lobby.label', 'Lobby')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/games/create')}
          className="home-menu__button"
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          <span className="ui-nowrap">{t('lobbyNew.actions.createTable', 'Create Table')}</span>
        </button>
      </div>

      <div className="home-menu__grid home-menu__grid--tertiary">
        <button
          type="button"
          onClick={() => navigate('/games/join')}
          className="home-menu__button home-menu__button--compact"
        >
          <FontAwesomeIcon icon={faLock} />
          <span className="ui-nowrap">{t('lobbyNew.actions.joinPrivate', 'Join Private')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="home-menu__button home-menu__button--compact"
        >
          <FontAwesomeIcon icon={faWallet} />
          <span className="ui-nowrap">{t('menu.wallet.label', 'Wallet')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="home-menu__button home-menu__button--compact"
        >
          <FontAwesomeIcon icon={faUser} />
          <span className="ui-nowrap">{t('menu.profile.label', 'Profile')}</span>
        </button>
      </div>

      <button type="button" className="home-menu__button home-menu__button--wide" disabled>
        <FontAwesomeIcon icon={faCircleQuestion} />
        <span className="ui-nowrap">{t('home.help.label', 'Help / Rules')}</span>
      </button>
    </div>
  )
}
