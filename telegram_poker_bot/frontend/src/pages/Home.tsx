import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  faPlay,
  faUserGroup,
  faTrophy,
  faGraduationCap,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { useTelegram } from '../hooks/useTelegram'
import Card from '../components/ui/Card'

export default function HomePage() {
  const { ready } = useTelegram()
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!ready) {
    return (
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  // Define the 4 main menu actions with their unique styles
  const menuActions = [
    {
      label: t('home.tiles.quickMatch.label', 'CASH GAME'),
      title: t('home.tiles.quickMatch.title', 'Quick Match'),
      subtitle: t('home.tiles.quickMatch.subtitle', 'Fast seat at best table'),
      icon: faPlay,
      variant: 'quickMatch',
      action: () => navigate('/lobby'),
    },
    {
      label: t('home.tiles.privateTable.label', 'PRIVATE'),
      title: t('home.tiles.privateTable.title', 'Private Table'),
      subtitle: t('home.tiles.privateTable.subtitle', 'Create your own game'),
      icon: faUserGroup,
      variant: 'privateTable',
      action: () => navigate('/games/create'),
    },
    {
      label: t('home.tiles.tournaments.label', 'COMPETE'),
      title: t('home.tiles.tournaments.title', 'Tournaments'),
      subtitle: t('home.tiles.tournaments.subtitle', 'Join competitive events'),
      icon: faTrophy,
      variant: 'tournaments',
      action: () => navigate('/lobby'), // TODO: tournaments route when ready
    },
    {
      label: t('home.tiles.practice.label', 'LEARN'),
      title: t('home.tiles.practice.title', 'Practice Mode'),
      subtitle: t('home.tiles.practice.subtitle', 'Improve your skills'),
      icon: faGraduationCap,
      variant: 'practice',
      action: () => navigate('/help'),
    },
  ]

  return (
    <div className="space-y-4 px-4 pt-6 pb-8">
      {/* Main Menu Square Tiles - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {menuActions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className={`menu-square-tile menu-square-tile--${action.variant} w-full`}
          >
            {/* Diagonal highlight layer */}
            <span className="menu-square-tile__highlight" aria-hidden="true" />
            
            {/* Button content */}
            <div className="menu-square-tile__content">
              <div className="menu-square-tile__text">
                <div className="menu-square-tile__label">
                  {action.label}
                </div>
                <div className="menu-square-tile__title">
                  {action.title}
                </div>
                <div className="menu-square-tile__subtitle">
                  {action.subtitle}
                </div>
              </div>
              <div className="menu-square-tile__icon">
                <FontAwesomeIcon icon={action.icon} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
