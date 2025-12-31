import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'

import Button from '../ui/Button'
import { formatChips } from '../../utils/formatChips'
import type { LobbyFilters } from './mockLobbyData'

interface FilterSheetProps {
  isOpen: boolean
  filters: LobbyFilters
  bounds: {
    stakesMin: number
    stakesMax: number
    buyInMin: number
    buyInMax: number
  }
  onChange: (filters: LobbyFilters) => void
  onClose: () => void
  onReset: () => void
  onSaveFavorite: () => void
  onLoadFavorite?: () => void
  hasSavedFilter?: boolean
}

const stakesStep = 0.25
const buyInStep = 20

export default function FilterSheet({
  isOpen,
  filters,
  bounds,
  onChange,
  onClose,
  onReset,
  onSaveFavorite,
  onLoadFavorite,
  hasSavedFilter = false,
}: FilterSheetProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const updateFilters = (patch: Partial<LobbyFilters>) => {
    onChange({ ...filters, ...patch })
  }

  const toggleSeat = (seat: number) => {
    const seats = filters.seats.includes(seat)
      ? filters.seats.filter((value) => value !== seat)
      : [...filters.seats, seat]
    updateFilters({ seats })
  }

  const stakeMinLabel = formatChips(filters.stakesMin)
  const stakeMaxLabel = formatChips(filters.stakesMax)
  const buyInMinLabel = formatChips(filters.buyInMin)
  const buyInMaxLabel = formatChips(filters.buyInMax)

  const renderToggleRow = (label: string, checked: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-[var(--border-2)] bg-[var(--surface-1)] px-4 py-3"
    >
      <span className="text-sm font-medium text-[var(--text-2)]">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-[var(--brand)]' : 'bg-[var(--border-3)]'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-[4px]'
          }`}
        />
      </span>
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe">
        <div className="mx-auto max-w-4xl rounded-t-3xl border border-[var(--border-2)] bg-[var(--surface-2)] p-5 shadow-[0_-16px_40px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text-1)]">
              {t('lobbyNew.filters.title', 'Filters')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] text-[var(--text-2)]"
              aria-label={t('lobbyNew.actions.close', 'Close')}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                <span>{t('lobbyNew.filters.stakesRange', 'Stakes range')}</span>
                <span className="tabular-nums">{`${stakeMinLabel} - ${stakeMaxLabel}`}</span>
              </div>
              <div className="mt-3 space-y-3">
                <input
                  type="range"
                  min={bounds.stakesMin}
                  max={bounds.stakesMax}
                  step={stakesStep}
                  value={filters.stakesMin}
                  onChange={(event) => {
                    const value = Math.min(Number(event.target.value), filters.stakesMax)
                    updateFilters({ stakesMin: value })
                  }}
                  className="action-range"
                />
                <input
                  type="range"
                  min={bounds.stakesMin}
                  max={bounds.stakesMax}
                  step={stakesStep}
                  value={filters.stakesMax}
                  onChange={(event) => {
                    const value = Math.max(Number(event.target.value), filters.stakesMin)
                    updateFilters({ stakesMax: value })
                  }}
                  className="action-range"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                <span>{t('lobbyNew.filters.buyInRange', 'Buy-in range')}</span>
                <span className="tabular-nums">{`${buyInMinLabel} - ${buyInMaxLabel}`}</span>
              </div>
              <div className="mt-3 space-y-3">
                <input
                  type="range"
                  min={bounds.buyInMin}
                  max={bounds.buyInMax}
                  step={buyInStep}
                  value={filters.buyInMin}
                  onChange={(event) => {
                    const value = Math.min(Number(event.target.value), filters.buyInMax)
                    updateFilters({ buyInMin: value })
                  }}
                  className="action-range"
                />
                <input
                  type="range"
                  min={bounds.buyInMin}
                  max={bounds.buyInMax}
                  step={buyInStep}
                  value={filters.buyInMax}
                  onChange={(event) => {
                    const value = Math.max(Number(event.target.value), filters.buyInMin)
                    updateFilters({ buyInMax: value })
                  }}
                  className="action-range"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                {t('lobbyNew.filters.seats', 'Seats')}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[2, 6].map((seatCount) => {
                  const active = filters.seats.includes(seatCount)
                  return (
                    <button
                      key={seatCount}
                      type="button"
                      onClick={() => toggleSeat(seatCount)}
                      className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition ${
                        active
                          ? 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-1)]'
                          : 'border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-3)]'
                      }`}
                    >
                      {seatCount}-max
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              {renderToggleRow(
                t('lobbyNew.filters.joinableOnly', 'Only joinable'),
                filters.joinableOnly,
                () => updateFilters({ joinableOnly: !filters.joinableOnly }),
              )}
              {renderToggleRow(
                t('lobbyNew.filters.favoritesOnly', 'Favorites only'),
                filters.favoritesOnly,
                () => updateFilters({ favoritesOnly: !filters.favoritesOnly }),
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="md" variant="secondary" className="min-h-[44px]" onClick={onReset}>
                {t('lobbyNew.actions.resetFilters', 'Reset filters')}
              </Button>
              {hasSavedFilter && onLoadFavorite && (
                <Button size="md" variant="secondary" className="min-h-[44px]" onClick={onLoadFavorite}>
                  {t('lobbyNew.actions.loadFilter', 'Use saved filter')}
                </Button>
              )}
              <Button size="md" variant="primary" className="min-h-[44px]" onClick={onSaveFavorite}>
                {t('lobbyNew.actions.saveFilter', 'Save as favorite filter')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
