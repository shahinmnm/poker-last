import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type ActionType = 'fold' | 'call' | 'check' | 'raise' | 'allin'

export interface ActionDockProps {
  /** Whether a hand is currently active */
  isHandActive: boolean
  /** Available actions for the current player */
  availableActions: ActionType[]
  /** Callback when an action is selected */
  onActionSelect: (action: ActionType) => void
  /** Amount to call (for display on call button) */
  callAmount?: number
  /** Whether actions are currently disabled (e.g., not player's turn) */
  disabled?: boolean
}

interface ActionButtonConfig {
  type: ActionType
  label: string
  variant: 'primary' | 'secondary'
}

/**
 * ActionDock - Context-aware player action buttons
 * 
 * Features:
 * - Appears at start of hand with fade-in + slide-up animation
 * - Staggered button animations
 * - Hides at end of hand with fade-out + scale-down
 * - Ghost pulse effect after hide
 * - Glassmorphic dark styling with neon accents
 */
export default function ActionDock({
  isHandActive,
  availableActions,
  onActionSelect,
  callAmount,
  disabled = false,
}: ActionDockProps) {
  const [showGhostPulse, setShowGhostPulse] = useState(false)

  // Handle ghost pulse when hand becomes inactive
  useEffect(() => {
    if (!isHandActive && availableActions.length > 0) {
      setShowGhostPulse(true)
      const timer = setTimeout(() => {
        setShowGhostPulse(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isHandActive, availableActions.length])

  const getActionConfig = (action: ActionType): ActionButtonConfig => {
    switch (action) {
      case 'fold':
        return { type: 'fold', label: 'Fold', variant: 'secondary' }
      case 'call':
        return {
          type: 'call',
          label: callAmount ? `Call ${callAmount}` : 'Call',
          variant: 'primary',
        }
      case 'check':
        return { type: 'check', label: 'Check', variant: 'secondary' }
      case 'raise':
        return { type: 'raise', label: 'Raise', variant: 'primary' }
      case 'allin':
        return { type: 'allin', label: 'All-in', variant: 'primary' }
      default:
        return { type: action, label: action, variant: 'secondary' }
    }
  }

  const actionButtons = availableActions.map(getActionConfig)

  return (
    <>
      {/* Main Action Dock */}
      <AnimatePresence mode="wait">
        {isHandActive && (
          <motion.div
            className="fixed inset-x-0 bottom-4 flex justify-center z-50 px-4"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div
              className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-3"
              style={{
                boxShadow: '0 0 40px rgba(0,0,0,0.7)',
              }}
            >
              <div className="flex gap-2 items-center">
                {actionButtons.map((action, index) => (
                  <motion.button
                    key={action.type}
                    onClick={() => !disabled && onActionSelect(action.type)}
                    disabled={disabled}
                    className={`
                      px-5 py-2.5 rounded-full text-sm font-medium
                      transition-all duration-200
                      ${
                        action.variant === 'primary'
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-900 border border-emerald-300/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                          : 'bg-slate-800/70 text-slate-100 border border-white/10 hover:bg-slate-700/70'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-97 cursor-pointer'}
                    `}
                    style={{ minHeight: '44px' }}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.2,
                      delay: index * 0.05,
                      ease: 'easeOut',
                    }}
                    whileHover={!disabled ? { scale: 1.05 } : {}}
                    whileTap={!disabled ? { scale: 0.97 } : {}}
                  >
                    {action.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost Pulse Effect */}
      <AnimatePresence>
        {showGhostPulse && (
          <motion.div
            className="fixed inset-x-0 bottom-8 flex justify-center z-40 pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="h-10 w-40 rounded-2xl bg-emerald-300/10 blur-xl"
              style={{
                boxShadow: '0 0 30px rgba(52,211,153,0.3)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
