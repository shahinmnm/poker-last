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

  // Single pot display - sleek golden-orange pill
  if (pots.length === 1) {
    return (
      <div className={`pot-display ${className}`}>
        <div className="min-h-[30px] h-8 px-4 rounded-full border border-orange-300/50 bg-black/50 backdrop-blur-xl shadow-md shadow-black/30 flex items-center justify-center">
          <div className="text-[13px] font-semibold text-amber-200 tracking-wide whitespace-nowrap tabular-nums max-w-[220px] overflow-hidden text-ellipsis">
            POT · {formatByCurrency(pots[0].amount, currency)}
          </div>
        </div>
      </div>
    )
  }

  // Multiple pots display - main pot with side pots below
  return (
    <div className={`pot-display flex flex-col items-center gap-1 ${className}`}>
      <div className="min-h-[30px] h-8 px-4 rounded-full border border-orange-300/50 bg-black/50 backdrop-blur-xl shadow-md shadow-black/30 flex items-center justify-center">
        <div className="text-[13px] font-semibold text-amber-200 tracking-wide whitespace-nowrap tabular-nums max-w-[220px] overflow-hidden text-ellipsis">
          POT · {formatByCurrency(totalPot, currency)}
        </div>
      </div>
      <div className="flex gap-2">
        {pots.map((pot, index) => (
          <div 
            key={pot.pot_index} 
            className="bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] text-gray-200 font-medium tabular-nums"
          >
            {index === 0 ? 'Main' : `Side ${index}`}: {formatByCurrency(pot.amount, currency)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PotDisplay
