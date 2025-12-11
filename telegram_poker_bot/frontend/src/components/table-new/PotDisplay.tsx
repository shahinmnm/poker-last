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
        <div className="bg-gradient-to-b from-orange-400 to-orange-600 shadow-lg border border-orange-300/50 rounded-full px-4 py-1">
          <div className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
            POT: {formatByCurrency(pots[0].amount, currency)}
          </div>
        </div>
      </div>
    )
  }

  // Multiple pots display - main pot with side pots below
  return (
    <div className={`pot-display flex flex-col items-center gap-1 ${className}`}>
      <div className="bg-gradient-to-b from-orange-400 to-orange-600 shadow-lg border border-orange-300/50 rounded-full px-4 py-1">
        <div className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
          POT: {formatByCurrency(totalPot, currency)}
        </div>
      </div>
      <div className="flex gap-2">
        {pots.map((pot, index) => (
          <div 
            key={pot.pot_index} 
            className="bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-gray-200 font-medium"
          >
            {index === 0 ? 'Main' : `Side ${index}`}: {formatByCurrency(pot.amount, currency)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PotDisplay
