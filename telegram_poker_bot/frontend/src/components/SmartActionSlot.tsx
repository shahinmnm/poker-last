import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faRightToBracket, faClock, faGift } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

import { cn } from '../utils/cn'

interface SmartActionSlotProps {
  mode: 'quickSeat' | 'backToTable' | 'lateReg' | 'claimBonus'
  to: string
  label: string
  timer?: string
  className?: string
}

const modeConfig: Record<string, { icon: IconDefinition; color: string }> = {
  quickSeat: { icon: faPlay, color: 'from-[#2cc57a] to-[#0ea968]' },
  backToTable: { icon: faRightToBracket, color: 'from-[#2cc57a] to-[#0ea968]' },
  lateReg: { icon: faClock, color: 'from-[#f59e0b] to-[#ea580c]' },
  claimBonus: { icon: faGift, color: 'from-[#ec4899] to-[#d946ef]' },
}

export function SmartActionSlot({ mode, to, label, timer, className }: SmartActionSlotProps) {
  const config = modeConfig[mode]

  return (
    <Link to={to} className={cn('block', className)}>
      <div
        className={cn(
          'flex flex-col items-center gap-1.5 transition-all duration-150 ease-out active:scale-95',
        )}
      >
        <div
          className={cn(
            'relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br border-2 border-white/30',
            config.color
          )}
          style={{ boxShadow: 'var(--shadow-accent-glow)' }}
        >
          <FontAwesomeIcon icon={config.icon} className="text-xl text-white" />
          {timer && (
            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-gray-900">
              {timer}
            </div>
          )}
        </div>
        <span
          className="text-[10px] font-semibold leading-tight text-center max-w-[60px]"
          style={{ color: 'var(--color-text)' }}
        >
          {label}
        </span>
      </div>
    </Link>
  )
}

export default SmartActionSlot
