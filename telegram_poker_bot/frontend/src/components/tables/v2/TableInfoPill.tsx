import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TableInfoPillProps {
  tableName?: string | null
  tableId: number
  smallBlind?: number
  bigBlind?: number
  playerCount?: number
  maxPlayers?: number
  mode?: string | null
  buyIn?: number
  onLeave?: () => void
  canLeave?: boolean
}

export default function TableInfoPill({
  tableName,
  tableId,
  smallBlind,
  bigBlind,
  playerCount,
  maxPlayers,
  mode,
  buyIn,
  onLeave,
  canLeave,
}: TableInfoPillProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const blindsLabel = useMemo(() => {
    if (smallBlind === undefined || bigBlind === undefined) return null
    return `${smallBlind}/${bigBlind}`
  }, [smallBlind, bigBlind])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-lg ring-1 ring-white/20 hover:bg-white/15"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
        <span className="truncate">{tableName || t('table.meta.defaultName', { id: tableId })}</span>
        {blindsLabel && <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold">{blindsLabel}</span>}
      </button>

      <div
        className={`absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/15 bg-black/70 text-sm text-white shadow-2xl backdrop-blur-2xl transition-all duration-200 ${open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-1'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-wide text-white/60">
          <span>{t('table.meta.table')}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase text-white hover:bg-white/20"
          >
            {t('common.actions.close', 'Close')}
          </button>
        </div>
        <div className="space-y-2 px-4 pb-4">
          <InfoRow label={t('table.meta.nameLabel', 'Name')} value={tableName || t('table.meta.defaultName', { id: tableId })} />
          {blindsLabel && <InfoRow label={t('table.meta.blinds')} value={blindsLabel} />}
          {mode && <InfoRow label={t('table.meta.mode')} value={mode} />}
          {playerCount !== undefined && maxPlayers !== undefined && (
            <InfoRow label={t('table.meta.players')} value={`${playerCount}/${maxPlayers}`} />
          )}
          {buyIn !== undefined && <InfoRow label={t('table.meta.buyIn', 'Buy-in')} value={buyIn} />}
          {canLeave && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onLeave?.()
              }}
              className="mt-2 w-full rounded-xl bg-red-500/80 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:bg-red-500"
            >
              {t('table.actions.leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-white/80">
      <span className="uppercase tracking-wide text-white/50">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}
