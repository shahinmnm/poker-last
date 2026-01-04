import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCirclePlus,
  faLock,
  faPlay,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons'

interface QuickSeatCardProps {
  recommendation?: {
    stakesLabel: string
    seatsOpen: number
    tableName?: string
  } | null
  fallbackLabel?: string
  onQuickSeat: () => void
  onCreate: () => void
  onJoinPrivate: () => void
  onRefresh: () => void
  disabled?: boolean
  actionsDisabled?: boolean
}

export default function QuickSeatCard({
  recommendation,
  fallbackLabel,
  onQuickSeat,
  onCreate,
  onJoinPrivate,
  onRefresh,
  disabled = false,
  actionsDisabled = false,
}: QuickSeatCardProps) {
  const { t } = useTranslation()

  const subtext = recommendation
    ? t('lobbyNew.quickSeat.recommendation', {
        defaultValue: '{{stakes}} • {{seats}} seats open',
        stakes: recommendation.stakesLabel,
        seats: recommendation.seatsOpen,
      })
    : fallbackLabel ?? t('common.loading', 'Loading...')

  return (
    <section className="quickseat-v2">
      {/* Hero: Play Now Section */}
      <div className="quickseat-v2__hero">
        <div className="quickseat-v2__label">
          <FontAwesomeIcon icon={faBolt} className="quickseat-v2__label-icon" />
          <span>{t('lobbyNew.quickSeat.eyebrow', 'Play Now')}</span>
        </div>
        
        <button
          type="button"
          onClick={onQuickSeat}
          disabled={disabled}
          className="quickseat-v2__cta"
          aria-label={t('lobbyNew.quickSeat.button', 'Quick Seat')}
        >
          <FontAwesomeIcon icon={faPlay} className="quickseat-v2__cta-icon" />
          <span className="quickseat-v2__cta-text">{t('lobbyNew.quickSeat.button', 'Quick Seat')}</span>
        </button>
        
        <p className="quickseat-v2__subtext">{subtext}</p>
      </div>

      {/* Secondary Action Strip */}
      <div className="quickseat-v2__actions">
        <button
          type="button"
          onClick={onCreate}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          <span>{t('lobbyNew.actions.create', 'Create')}</span>
        </button>
        <button
          type="button"
          onClick={onJoinPrivate}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faLock} />
          <span>{t('lobbyNew.actions.joinPrivateShort', 'Private')}</span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          <span>{t('lobbyNew.actions.refresh', 'Refresh')}</span>
        </button>
      </div>
    </section>
  )
}
