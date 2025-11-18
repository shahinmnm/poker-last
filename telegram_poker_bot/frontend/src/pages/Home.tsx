import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { faPlay, faChartLine } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Card from '../components/ui/Card'
import FilterPills from '../components/ui/FilterPills'
import RecommendationCard from '../components/ui/RecommendationCard'

export default function HomePage() {
  const { ready, initData } = useTelegram()
  const { t } = useTranslation()
  const [activeTables, setActiveTables] = useState<any[]>([])
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    if (!initData) return

    // Fetch active tables to show contextual recommendations
    apiFetch<{ tables: any[] }>('/users/me/tables', { initData })
      .then((data) => setActiveTables(data.tables || []))
      .catch(() => setActiveTables([]))
  }, [initData])

  const hasActiveTables = activeTables.length > 0

  if (!ready) {
    return (
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  const filterOptions = [
    { id: 'all', label: t('home.filters.all', 'All') },
    { id: 'cash', label: t('home.filters.cash', 'Cash') },
    { id: 'tournaments', label: t('home.filters.tournaments', 'Tournaments') },
    { id: 'private', label: t('home.filters.private', 'Private') },
  ]

  return (
    <div className="space-y-6 pt-4">
      {/* Filter Pills */}
      <div className="px-4">
        <FilterPills
          options={filterOptions}
          activeId={activeFilter}
          onChange={setActiveFilter}
        />
      </div>

      {/* Recommendation Card */}
      <div className="px-4">
        <RecommendationCard
          title={hasActiveTables ? t('home.recommendation.continueTitle', 'Continue playing') : t('home.recommendation.nextTitle', 'Start your first game')}
          subtitle={hasActiveTables ? t('home.recommendation.continueSubtitle', 'You have active tables waiting') : t('home.recommendation.nextSubtitle', 'Join a public table or create your own')}
          icon={hasActiveTables ? faChartLine : faPlay}
          to={hasActiveTables ? '/profile/stats' : '/lobby'}
        />
      </div>
    </div>
  )
}
