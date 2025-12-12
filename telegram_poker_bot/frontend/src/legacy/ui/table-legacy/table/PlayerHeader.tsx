import { LogOut, MoreVertical, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PlayerHeaderProps {
  playerName: string
  chipCount: number
  tableLabel: string
  isMyTurn?: boolean
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)

export default function PlayerHeader({
  playerName,
  chipCount,
  tableLabel,
  isMyTurn = false,
}: PlayerHeaderProps) {
  const { t } = useTranslation()
  const chipDisplay = formatNumber(chipCount)

  return (
    <div className="pointer-events-none absolute left-4 right-4 top-4 z-50 flex items-start justify-between text-white font-['Inter',_sans-serif]">
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          aria-label={t('table.actions.close', { defaultValue: 'Close table' })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 active:scale-95"
        >
          <X size={18} />
        </button>

        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 shadow-lg backdrop-blur-md ${
            isMyTurn
              ? 'border-emerald-300/60 bg-black/50'
              : 'border-white/10 bg-black/40'
          }`}
          title={playerName}
        >
          <span className="text-[11px] font-medium text-gray-200">{tableLabel}</span>
          <span className="text-[10px] font-semibold text-emerald-300">
            {t('table.actionBar.currentChips', {
              amount: chipDisplay,
              defaultValue: `${chipDisplay} chips`,
            })}
          </span>
          <span className="sr-only">{playerName}</span>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          aria-label={t('table.actions.leaveSeat', { defaultValue: 'Leave seat' })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 active:scale-95"
        >
          <LogOut size={18} />
        </button>
        <button
          type="button"
          aria-label={t('table.menu.open', { defaultValue: 'Table menu' })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 active:scale-95"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  )
}
