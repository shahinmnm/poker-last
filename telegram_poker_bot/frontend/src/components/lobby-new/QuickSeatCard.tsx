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
  const recommendationSuffix = recommendation?.tableName ? ` - ${recommendation.tableName}` : ''

  return (
    <div className="quickseat-card">
      <div className="quickseat-card__hero">
        <div className="quickseat-card__eyebrow">
          <FontAwesomeIcon icon={faBolt} />
          <span>{t('lobbyNew.quickSeat.eyebrow', 'Play now')}</span>
        </div>

        <div className="quickseat-card__headline">
          <div className="quickseat-card__title">
            <h2 className="quickseat-card__title-text">
              {t('lobbyNew.quickSeat.button', 'Quick Seat')}
            </h2>
            <p className="quickseat-card__subtitle" dir="auto">
              {recommendation?.tableName ??
                t('lobbyNew.quickSeat.subtitle', 'Best open seat right now')}
            </p>
          </div>
          <div className="quickseat-card__tag" aria-live="polite">
            <span className="quickseat-card__tag-label">
              {recommendation
                ? t('lobbyNew.quickSeat.seats', '{{count}} open', { count: recommendation.seatsOpen })
                : t('lobbyNew.quickSeat.empty', 'Finding seats...')}
            </span>
          </div>
        </div>

        <div className="quickseat-card__cta-row">
          <button
            type="button"
            onClick={onQuickSeat}
            disabled={disabled}
            className="quickseat-card__cta ui-cta"
            aria-label={t('lobbyNew.quickSeat.button', 'Quick Seat')}
          >
            <FontAwesomeIcon icon={faPlay} />
            <span className="quickseat-card__cta-label">
              {t('lobbyNew.quickSeat.button', 'Quick Seat')}
            </span>
          </button>
          <div className="quickseat-card__meta" dir="auto">
            <span className="quickseat-card__meta-label">
              {t('lobbyNew.quickSeat.recommendationShort', 'Recommended table')}
            </span>
            <span className="quickseat-card__meta-value">
              {recommendationLabel}
              {recommendationSuffix}
            </span>
          </div>
        </div>
      </div>

      <div className="quickseat-card__actions" aria-label={t('lobbyNew.quickSeat.moreActions', 'More actions')}>
        <button
          type="button"
          onClick={onCreate}
          disabled={actionsDisabled}
          className="quickseat-card__action ui-pill"
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          <span className="quickseat-card__action-label">
            {t('lobbyNew.actions.create', 'Create')}
          </span>
        </button>
        <button
          type="button"
          onClick={onJoinPrivate}
          disabled={actionsDisabled}
          className="quickseat-card__action ui-pill"
        >
          <FontAwesomeIcon icon={faLock} />
          <span className="quickseat-card__action-label">
            {t('lobbyNew.actions.joinPrivateShort', 'Join Private')}
          </span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={actionsDisabled}
          className="quickseat-card__action ui-pill"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          <span className="quickseat-card__action-label">
            {t('lobbyNew.actions.refresh', 'Refresh')}
          </span>
        </button>
      </div>
    </div>
  )
}
