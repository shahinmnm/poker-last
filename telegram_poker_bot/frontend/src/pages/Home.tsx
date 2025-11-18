import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  faPlay,
  faUserGroup,
  faTrophy,
  faGraduationCap,
} from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import Card from '../components/ui/Card'
import MainTile from '../components/ui/MainTile'
import MainTilesGrid from '../components/ui/MainTilesGrid'

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

  // Define the 4 main menu tiles with their unique accent gradients
  const menuTiles = [
    {
      label: t('home.tiles.quickMatch.label', 'CASH GAME'),
      title: t('home.tiles.quickMatch.title', 'Quick Match'),
      subtitle: t('home.tiles.quickMatch.subtitle', 'Fast seat at best table'),
      icon: faPlay,
      accentGradient: 'rgb(139, 92, 246) rgb(236, 72, 153)', // violet → pink
      action: () => navigate('/lobby'),
    },
    {
      label: t('home.tiles.privateTable.label', 'PRIVATE'),
      title: t('home.tiles.privateTable.title', 'Private Table'),
      subtitle: t('home.tiles.privateTable.subtitle', 'Create your own game'),
      icon: faUserGroup,
      accentGradient: 'rgb(239, 68, 68) rgb(249, 115, 22)', // red → orange
      action: () => navigate('/games/create'),
    },
    {
      label: t('home.tiles.tournaments.label', 'COMPETE'),
      title: t('home.tiles.tournaments.title', 'Tournaments'),
      subtitle: t('home.tiles.tournaments.subtitle', 'Join competitive events'),
      icon: faTrophy,
      accentGradient: 'rgb(251, 191, 36) rgb(217, 119, 6)', // gold → copper
      action: () => navigate('/lobby'), // TODO: tournaments route when ready
    },
    {
      label: t('home.tiles.practice.label', 'LEARN'),
      title: t('home.tiles.practice.title', 'Practice Mode'),
      subtitle: t('home.tiles.practice.subtitle', 'Improve your skills'),
      icon: faGraduationCap,
      accentGradient: 'rgb(59, 130, 246) rgb(139, 92, 246)', // blue → violet
      action: () => navigate('/help'),
    },
  ]

  return (
    <div className="space-y-6 px-4 pt-6 pb-8">
      {/* Main Menu Tiles Grid */}
      <MainTilesGrid>
        {menuTiles.map((tile, index) => (
          <MainTile
            key={index}
            label={tile.label}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={tile.icon}
            accentGradient={tile.accentGradient}
            onClick={tile.action}
          />
        ))}
      </MainTilesGrid>
    </div>
  )
}
