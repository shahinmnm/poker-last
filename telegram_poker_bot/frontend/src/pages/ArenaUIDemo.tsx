import { useState } from 'react'
import ActionDock from '../components/tables/ActionDock'
import PlayerAvatarHUD, { type Player } from '../components/tables/PlayerAvatarHUD'
import PokerFeltBackground from '../components/background/PokerFeltBackground'

/**
 * ArenaUIDemo - Showcase page for Action Dock and Player Avatar HUD components
 * 
 * This demo page shows the immersive arena UI components in action:
 * - ActionDock with glassmorphic styling and animations
 * - PlayerAvatarHUD with turn indicators and info panels
 */
export default function ArenaUIDemo() {
  const [isHandActive, setIsHandActive] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)

  // Sample players data
  const players: Player[] = [
    {
      id: '1',
      username: 'Player One',
      initials: 'P1',
      chips: 5000,
      lastAction: 'Raised 200',
      status: 'ACTIVE',
      isDealer: true,
      isCurrentTurn: false,
      turnProgress: 0,
    },
    {
      id: '2',
      username: 'Player Two',
      initials: 'P2',
      chips: 3500,
      lastAction: 'Call',
      status: 'ACTIVE',
      isDealer: false,
      isCurrentTurn: true,
      turnProgress: 0.7,
    },
    {
      id: '3',
      username: 'Player Three',
      initials: 'P3',
      chips: 2000,
      status: 'FOLDED',
      isDealer: false,
      isCurrentTurn: false,
      turnProgress: 0,
    },
    {
      id: '4',
      username: 'Player Four',
      initials: 'P4',
      chips: 8500,
      lastAction: 'Check',
      status: 'ACTIVE',
      isDealer: false,
      isCurrentTurn: false,
      turnProgress: 0,
      isWinner: true,
    },
    {
      id: '5',
      username: 'Player Five',
      initials: 'P5',
      chips: 1500,
      status: 'ALL_IN',
      isDealer: false,
      isCurrentTurn: false,
      turnProgress: 0,
    },
  ]

  const handleActionSelect = (action: string) => {
    setSelectedAction(action)
    console.log('Action selected:', action)
    
    // Simulate hand ending after action
    setTimeout(() => {
      setIsHandActive(false)
      // Restart hand after 2 seconds
      setTimeout(() => {
        setIsHandActive(true)
        setSelectedAction(null)
      }, 2000)
    }, 500)
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Poker Felt Background */}
      <PokerFeltBackground>
        {/* Demo Controls */}
        <div className="absolute top-4 left-4 z-50">
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-3">
            <h2 className="text-white font-bold text-sm">Arena UI Demo</h2>
            <div className="space-y-2">
              <button
                onClick={() => setIsHandActive(!isHandActive)}
                className="w-full px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
              >
                {isHandActive ? 'End Hand' : 'Start Hand'}
              </button>
              {selectedAction && (
                <div className="text-xs text-white/70">
                  Last action: <span className="text-emerald-300 font-semibold">{selectedAction}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 max-w-xs">
            <h3 className="text-white font-bold text-sm mb-2">Component Features</h3>
            <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
              <li>Glassmorphic dark styling</li>
              <li>Framer Motion animations</li>
              <li>Turn pulse indicators</li>
              <li>Click outside to close panels</li>
              <li>Responsive tap-friendly design</li>
              <li>No scroll, fixed viewport</li>
            </ul>
          </div>
        </div>

        {/* Player Avatars positioned around the table */}
        <div className="absolute top-1/4 left-1/4">
          <PlayerAvatarHUD player={players[0]} positionHint="bottom" />
        </div>

        <div className="absolute top-1/4 right-1/4">
          <PlayerAvatarHUD player={players[1]} positionHint="bottom" />
        </div>

        <div className="absolute top-1/2 left-12">
          <PlayerAvatarHUD player={players[2]} positionHint="right" />
        </div>

        <div className="absolute top-1/2 right-12">
          <PlayerAvatarHUD player={players[3]} positionHint="left" />
        </div>

        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2">
          <PlayerAvatarHUD player={players[4]} positionHint="top" />
        </div>

        {/* Action Dock */}
        <ActionDock
          isHandActive={isHandActive}
          availableActions={['fold', 'call', 'raise', 'allin']}
          onActionSelect={handleActionSelect}
          callAmount={200}
          disabled={false}
        />

        {/* Center pot area (just for visual reference) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-3">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                Pot
              </div>
              <div className="text-xl font-bold text-amber-300">1,500</div>
            </div>
          </div>
        </div>
      </PokerFeltBackground>
    </div>
  )
}
