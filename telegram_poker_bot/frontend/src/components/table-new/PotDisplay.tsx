/**
 * PotDisplay Component
 * 
 * Displays the pot amount(s) in a floating pill with golden-orange gradient.
 * Modern, minimalist design inspired by GGPoker/PokerBros.
 */

import { formatByCurrency, type CurrencyType } from '@/utils/currency'
import type { Pot } from '../../types/normalized'

interface PotDisplayProps {
  pots: Pot[]
  currency?: CurrencyType
  className?: string
}

export function PotDisplay({ pots, currency = 'PLAY', className = '' }: PotDisplayProps) {
  if (pots.length === 0) return null

  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0)

  return (
    <div className={`pot-display ${className}`}>
      <div className="min-h-[30px] h-8 px-4 rounded-full border border-orange-300/40 bg-black/55 backdrop-blur-xl shadow-md shadow-black/30 flex items-center justify-center pointer-events-none">
        <div className="text-[13px] font-semibold text-amber-100 tracking-wide whitespace-nowrap tabular-nums max-w-[240px] overflow-hidden text-ellipsis">
          Total pot {formatByCurrency(totalPot, currency)}
        </div>
      </div>
    </div>
  )
}

export default PotDisplay
