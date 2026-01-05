import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
} from '@fortawesome/free-solid-svg-icons'

interface QuickSeatCardProps {
  recommendation?: {
    stakesLabel: string
    seatsOpen: number
    tableName?: string
  } | null
  fallbackLabel?: string
  onQuickSeat: () => void
  disabled?: boolean
}

export default function QuickSeatCard({
  recommendation,
  fallbackLabel,
  onQuickSeat,
  disabled = false,
}: QuickSeatCardProps) {
  const { t } = useTranslation()

  const subtext = recommendation
    ? t('lobbyNew.quickSeat.recommendationCompact', {
        defaultValue: 'Recommended: {{stakes}} | {{seats}} open',
        stakes: recommendation.stakesLabel,
        seats: recommendation.seatsOpen,
      })
    : fallbackLabel ?? t('common.loading', 'Loading...')

  return (
    <section className="quickseat-v2">
      <div className="quickseat-v2__context">
        <div className="quickseat-v2__label ui-nowrap">
          <FontAwesomeIcon icon={faBolt} className="quickseat-v2__label-icon" />
          <span className="ui-nowrap">{t('lobbyNew.quickSeat.title', 'Quick Seat')}</span>
        </div>
        <p className="quickseat-v2__subtext ui-nowrap" dir="auto">{subtext}</p>
      </div>

      <button
        type="button"
        onClick={onQuickSeat}
        disabled={disabled}
        className="quickseat-v2__cta"
        aria-label={t('lobbyNew.quickSeat.button', 'Quick Seat')}
      >
        <FontAwesomeIcon icon={faBolt} className="quickseat-v2__cta-icon" />
        <span className="quickseat-v2__cta-text ui-nowrap">
          {t('lobbyNew.quickSeat.button', 'Quick Seat')}
        </span>
      </button>
    </section>
  )
}
