import type { HandResultPayload } from '@/types/game'
import type { CurrencyType } from '@/utils/currency'
import { formatByCurrency } from '@/utils/currency'

import PlayingCard from '../ui/PlayingCard'

interface WinnerShowcaseProps {
  handResult?: HandResultPayload | null
  players: Array<{ user_id: number | string; display_name?: string | null; username?: string | null }>
  currencyType?: CurrencyType
}

function formatChips(amount: number, currencyType: CurrencyType = 'REAL'): string {
  const display = formatByCurrency(Math.abs(amount), currencyType, { withDecimals: currencyType === 'REAL' })
  return amount >= 0 ? `+${display}` : `-${display}`
}

export default function WinnerShowcase({ handResult, players, currencyType = 'REAL' }: WinnerShowcaseProps) {
  const winners = handResult?.winners ?? []
  const primaryWinner =
    winners.length > 0
      ? winners.reduce(
          (currentBest, contender) =>
            contender.amount > currentBest.amount ? contender : currentBest,
          winners[0],
        )
      : null

  if (!primaryWinner) {
    return (
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center shadow-lg">
        <p className="text-sm font-semibold text-white">Waiting for winner data…</p>
        <p className="text-xs text-white/70">The next hand will begin shortly.</p>
      </div>
    )
  }

  const winnerName =
    players.find((player) => player.user_id.toString() === primaryWinner.user_id.toString())?.display_name ||
    players.find((player) => player.user_id.toString() === primaryWinner.user_id.toString())?.username ||
    `Player ${primaryWinner.user_id}`

  const bestHandCards = primaryWinner.best_hand_cards ?? []

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-sky-500/10 px-6 py-5 text-center shadow-2xl backdrop-blur-md">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">Winner</p>
      <h2 className="mt-1 text-3xl font-black text-white drop-shadow-sm">{winnerName}</h2>
      <p className="mt-2 text-lg font-semibold text-emerald-300">
        {formatChips(primaryWinner.amount, currencyType)}
      </p>
      {primaryWinner.hand_rank && (
        <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-white/80">{primaryWinner.hand_rank}</p>
      )}
      <div className="mt-3 flex items-center justify-center gap-2">
        {bestHandCards.length ? (
          bestHandCards.map((card, idx) => (
            <PlayingCard key={`${card}-${idx}`} card={card} size="md" highlighted />
          ))
        ) : (
          <span className="text-xs text-white/70">Winning cards unavailable</span>
        )}
      </div>
    </div>
  )
}
