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

  const recommendationLabel = recommendation
    ? t('lobbyNew.quickSeat.recommendation', {
        defaultValue: '{{stakes}} - {{seats}} seats open',
        stakes: recommendation.stakesLabel,
        seats: recommendation.seatsOpen,
      })
    : fallbackLabel ?? t('common.loading', 'Loading...')

  return (
    <div className="quickseat-strip">
      <button
        type="button"
        onClick={onQuickSeat}
        disabled={disabled}
        className="quickseat-strip__primary"
        aria-label={t('lobbyNew.quickSeat.button', 'Quick Seat')}
      >
        <FontAwesomeIcon icon={faPlay} />
        <span className="quickseat-strip__primary-label">
          {t('lobbyNew.quickSeat.button', 'Quick Seat')}
        </span>
      </button>

      <div className="quickseat-strip__details">
        <span className="quickseat-strip__label">
          <FontAwesomeIcon icon={faBolt} />
        </span>
        <span className="quickseat-strip__text" dir="auto">
          {recommendationLabel}
          {recommendation?.tableName ? ` - ${recommendation.tableName}` : ''}
        </span>
      </div>

      <div className="quickseat-strip__actions">
        <button
          type="button"
          onClick={onCreate}
          disabled={actionsDisabled}
          className="quickseat-strip__action"
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          <span className="quickseat-strip__action-label">
            {t('lobbyNew.actions.create', 'Create')}
          </span>
        </button>
        <button
          type="button"
          onClick={onJoinPrivate}
          disabled={actionsDisabled}
          className="quickseat-strip__action"
        >
          <FontAwesomeIcon icon={faLock} />
          <span className="quickseat-strip__action-label">
            {t('lobbyNew.actions.joinPrivateShort', 'Join Private')}
          </span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={actionsDisabled}
          className="quickseat-strip__action"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          <span className="quickseat-strip__action-label">
            {t('lobbyNew.actions.refresh', 'Refresh')}
          </span>
        </button>
      </div>
    </div>
  )
}
