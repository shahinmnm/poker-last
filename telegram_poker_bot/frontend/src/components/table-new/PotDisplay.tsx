/**
 * PotDisplay Component
 * 
 * Displays the pot amount(s) in a clean, centered display.
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

  // Single pot display
  if (pots.length === 1) {
    return (
      <div className={`pot-display ${className}`}>
        <div className="bg-gray-900 bg-opacity-90 rounded-lg px-6 py-3 border border-yellow-600">
          <div className="text-xs text-gray-400 uppercase tracking-wide text-center mb-1">
            Pot
          </div>
          <div className="text-2xl font-bold text-yellow-400 font-mono text-center">
            {formatByCurrency(pots[0].amount, currency)}
          </div>
        </div>
      </div>
    )
  }

  // Multiple pots display
  return (
    <div className={`pot-display ${className}`}>
      <div className="bg-gray-900 bg-opacity-90 rounded-lg px-6 py-3 border border-yellow-600">
        <div className="text-xs text-gray-400 uppercase tracking-wide text-center mb-1">
          Total Pot
        </div>
        <div className="text-2xl font-bold text-yellow-400 font-mono text-center">
          {formatByCurrency(totalPot, currency)}
        </div>
        <div className="mt-2 flex gap-2 justify-center">
          {pots.map((pot, index) => (
            <div key={pot.pot_index} className="text-xs text-gray-400">
              {index > 0 && <span className="mx-1">•</span>}
              <span className="font-mono">{formatByCurrency(pot.amount, currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PotDisplay
