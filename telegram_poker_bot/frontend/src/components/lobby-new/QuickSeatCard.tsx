import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faPlay } from '@fortawesome/free-solid-svg-icons'

import Button from '../ui/Button'

interface QuickSeatCardProps {
  recommendation?: {
    stakesLabel: string
    seatsOpen: number
    tableName?: string
  } | null
  onQuickSeat: () => void
  disabled?: boolean
}

export default function QuickSeatCard({ recommendation, onQuickSeat, disabled = false }: QuickSeatCardProps) {
  const { t } = useTranslation()

  const recommendationLabel = recommendation
    ? t('lobbyNew.quickSeat.recommendation', {
        defaultValue: 'Recommended: {{stakes}} - {{seats}} seats open',
        stakes: recommendation.stakesLabel,
        seats: recommendation.seatsOpen,
      })
    : t('common.loading', 'Loading...')

  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-3)]">
            <FontAwesomeIcon icon={faBolt} />
            <span>{t('lobbyNew.quickSeat.title', 'Quick Seat')}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text-1)]">
            {t('lobbyNew.quickSeat.cta', 'Play Now')}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-3)] tabular-nums" dir="auto">
            {recommendationLabel}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="min-h-[44px] px-6"
          onClick={onQuickSeat}
          disabled={disabled}
        >
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faPlay} />
            {t('lobbyNew.quickSeat.button', 'Quick Seat')}
          </span>
        </Button>
      </div>
    </div>
  )
}
