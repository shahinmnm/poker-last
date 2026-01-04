import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCirclePlus,
  faLock,
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
    ? t('lobbyNew.quickSeat.recommendationCompact', {
        defaultValue: 'Recommended: {{stakes}} • {{seats}} seats open',
        stakes: recommendation.stakesLabel,
        seats: recommendation.seatsOpen,
      })
    : fallbackLabel ?? t('common.loading', 'Loading...')

  return (
    <section className="quickseat-v2">
      <div className="quickseat-v2__hero">
        <div className="quickseat-v2__info">
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
      </div>

      <div className="quickseat-v2__actions">
        <button
          type="button"
          onClick={onCreate}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          <span className="ui-nowrap">{t('lobbyNew.actions.create', 'Create')}</span>
        </button>
        <button
          type="button"
          onClick={onJoinPrivate}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faLock} />
          <span className="ui-nowrap">{t('lobbyNew.actions.joinPrivateShort', 'Private')}</span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={actionsDisabled}
          className="quickseat-v2__action"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          <span className="ui-nowrap">{t('lobbyNew.actions.refresh', 'Refresh')}</span>
        </button>
      </div>
    </section>
  )
}
