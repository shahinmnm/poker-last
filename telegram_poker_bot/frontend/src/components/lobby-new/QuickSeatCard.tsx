import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCirclePlus,
  faLock,
  faPlay,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons'

import { cn } from '../../utils/cn'

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
    <div className="lobby-quickseat rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] p-2 shadow-[0_10px_26px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onQuickSeat}
          disabled={disabled}
          className="group inline-flex min-h-[44px] items-center disabled:cursor-not-allowed"
          aria-label={t('lobbyNew.quickSeat.button', 'Quick Seat')}
        >
          <span
            className={cn(
              'flex h-9 items-center gap-2 rounded-full px-4 text-[clamp(11px,1.6vw,12px)] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,0.25)] transition',
              'bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)]',
              'group-active:scale-[0.98]',
              disabled && 'opacity-60',
            )}
          >
            <FontAwesomeIcon icon={faPlay} />
            {t('lobbyNew.quickSeat.button', 'Quick Seat')}
          </span>
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[clamp(11px,1.5vw,12px)] text-[var(--text-3)]">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-[0.16em] text-[clamp(9px,1.4vw,10px)] text-[var(--text-2)]">
            <FontAwesomeIcon icon={faBolt} />
            {t('lobbyNew.quickSeat.title', 'Quick Seat')}
          </span>
          <span className="tabular-nums" dir="auto">
            {recommendationLabel}
          </span>
          {recommendation?.tableName && (
            <span className="max-w-[160px] truncate text-[var(--text-2)]" dir="auto">
              {recommendation.tableName}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" style={{ marginInlineStart: 'auto' }}>
        <button
          type="button"
          onClick={onCreate}
          disabled={actionsDisabled}
          className="group inline-flex min-h-[44px] items-center disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              'flex h-8 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 text-[clamp(11px,1.5vw,12px)] font-semibold text-[var(--text-2)] transition group-active:scale-[0.97]',
              actionsDisabled && 'opacity-60',
            )}
          >
            <FontAwesomeIcon icon={faCirclePlus} className="text-[10px]" />
            {t('lobbyNew.actions.create', 'Create')}
          </span>
        </button>
        <button
          type="button"
          onClick={onJoinPrivate}
          disabled={actionsDisabled}
          className="group inline-flex min-h-[44px] items-center disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              'flex h-8 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 text-[clamp(11px,1.5vw,12px)] font-semibold text-[var(--text-2)] transition group-active:scale-[0.97]',
              actionsDisabled && 'opacity-60',
            )}
          >
            <FontAwesomeIcon icon={faLock} className="text-[10px]" />
            {t('lobbyNew.actions.joinPrivateShort', 'Join Private')}
          </span>
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={actionsDisabled}
          className="group inline-flex min-h-[44px] items-center disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              'flex h-8 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 text-[clamp(11px,1.5vw,12px)] font-semibold text-[var(--text-2)] transition group-active:scale-[0.97]',
              actionsDisabled && 'opacity-60',
            )}
          >
            <FontAwesomeIcon icon={faRotateRight} className="text-[10px]" />
            {t('lobbyNew.actions.refresh', 'Refresh')}
          </span>
        </button>
        </div>
      </div>
    </div>
  )
}
