import { useMemo } from 'react'
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
  const initial = useMemo(() => playerName.charAt(0)?.toUpperCase() || '?', [playerName])

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b3a20]/70 px-4 py-3 shadow-lg backdrop-blur-md">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-400/40 text-lg font-bold text-white shadow-inner ${
          isMyTurn ? 'ring-2 ring-emerald-300 shadow-emerald-500/40' : 'ring-1 ring-white/10'
        }`}
        aria-label={playerName}
      >
        {initial}
      </div>

      <div className="flex flex-col text-white">
        <span className="text-sm font-semibold leading-tight">{playerName}</span>
        <span className="text-xs font-semibold text-emerald-100/90">
          {t('table.actionBar.currentChips', {
            amount: formatNumber(chipCount),
            defaultValue: `${formatNumber(chipCount)} chips`,
          })}
        </span>
      </div>

      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-50 ${
          isMyTurn
            ? 'border-emerald-300/70 bg-emerald-900/60 shadow-[0_0_12px_rgba(0,201,141,0.35)]'
            : 'border-white/10 bg-white/5'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isMyTurn ? 'bg-emerald-300' : 'bg-amber-300'}`} aria-hidden />
        <span>{tableLabel}</span>
      </div>
    </div>
  )
}
