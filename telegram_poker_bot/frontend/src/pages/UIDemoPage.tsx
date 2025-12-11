/**
 * UI/UX Demo Page - Visual showcase of new components
 */

import { useState } from 'react'
import ConnectionStatus from '../components/ui/ConnectionStatus'
import { Loader2 } from 'lucide-react'
import type { ConnectionState } from '../types/normalized'
import PlayerSeat from '../legacy/ui/table-legacy/table/PlayerSeat'
import CommunityBoard from '../legacy/ui/table-legacy/table/CommunityBoard'

export default function UIDemoPage() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('live')
  const [showOverlay, setShowOverlay] = useState(false)
  const [playerCount, setPlayerCount] = useState(5)
  const [waitlistCount, setWaitlistCount] = useState(2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">UI/UX Enhancement Demo</h1>

        {/* PlayerSeat Demo - NEW */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">PlayerSeat - 4-Directional Layout</h2>
          <p className="text-gray-400 mb-4">Direction-aware Flexbox layout with gravity towards table center</p>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm text-gray-300">Bottom Seat (Hero)</h3>
              <div className="p-8 bg-emerald-900/30 rounded-xl relative min-h-[160px] flex items-center justify-center">
                <PlayerSeat
                  playerName="Hero Player"
                  chipCount={15000}
                  seatLabel="Seat 1"
                  positionLabel="BTN"
                  isHero={true}
                  isActive={true}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={false}
                  holeCards={['Ah', 'Kh']}
                  side="bottom"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm text-gray-300">Top Seat (Villain)</h3>
              <div className="p-8 bg-rose-900/30 rounded-xl relative min-h-[160px] flex items-center justify-center">
                <PlayerSeat
                  playerName="Villain"
                  chipCount={8500}
                  seatLabel="Seat 4"
                  positionLabel="SB"
                  isHero={false}
                  isActive={false}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={false}
                  showCardBacks={true}
                  holeCards={['XX', 'XX']}
                  side="top"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm text-gray-300">Left Seat (Side Villain)</h3>
              <div className="p-8 bg-blue-900/30 rounded-xl relative min-h-[160px] min-w-[200px] flex items-center justify-center">
                <PlayerSeat
                  playerName="LeftPlayer"
                  chipCount={12000}
                  seatLabel="Seat 2"
                  positionLabel="BB"
                  isHero={false}
                  isActive={false}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={false}
                  showCardBacks={true}
                  holeCards={['XX', 'XX']}
                  side="left"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm text-gray-300">Right Seat (Side Villain)</h3>
              <div className="p-8 bg-purple-900/30 rounded-xl relative min-h-[160px] min-w-[200px] flex items-center justify-center">
                <PlayerSeat
                  playerName="RightPlayer"
                  chipCount={9500}
                  seatLabel="Seat 5"
                  isHero={false}
                  isActive={true}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={false}
                  showCardBacks={true}
                  holeCards={['XX', 'XX']}
                  side="right"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xs text-gray-400">Folded</h3>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <PlayerSeat
                  playerName="FoldedPlayer"
                  chipCount={5000}
                  seatLabel="Seat 2"
                  isHero={false}
                  isActive={false}
                  hasFolded={true}
                  isSittingOut={false}
                  isAllIn={false}
                  side="bottom"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xs text-gray-400">All-In</h3>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <PlayerSeat
                  playerName="AllInPlayer"
                  chipCount={0}
                  seatLabel="Seat 3"
                  isHero={false}
                  isActive={false}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={true}
                  holeCards={['Qd', 'Jd']}
                  side="bottom"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xs text-gray-400">Empty Seat</h3>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <PlayerSeat
                  playerName=""
                  chipCount={0}
                  seatLabel="Seat 5"
                  isHero={false}
                  isActive={false}
                  hasFolded={false}
                  isSittingOut={false}
                  isAllIn={false}
                  isEmpty={true}
                  side="bottom"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CommunityBoard Demo - NEW */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">CommunityBoard - Cinematic Design</h2>
          <p className="text-gray-400 mb-4">Tight board line with black/20 bg and backdrop blur</p>
          
          <div className="p-6 bg-emerald-900/20 rounded-xl">
            <CommunityBoard
              potAmount={2500}
              cards={['Ah', 'Kd', 'Qc', 'Jh', 'Ts']}
              highlightedCards={['Ah', 'Kd']}
            />
          </div>
          
          <div className="mt-4 p-6 bg-emerald-900/20 rounded-xl">
            <h3 className="text-sm text-gray-300 mb-2">Flop Only</h3>
            <CommunityBoard
              potAmount={500}
              cards={['7s', '2h', '9d']}
            />
          </div>
        </section>
        
        {/* ConnectionStatus Demo */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">1. Enhanced ConnectionStatus</h2>
          <p className="text-gray-400 mb-4">Glassmorphism pill design with Lucide icons</p>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setConnectionState('live')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Set Live
              </button>
              <button
                onClick={() => setConnectionState('connecting')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                Set Connecting
              </button>
              <button
                onClick={() => setConnectionState('syncing_snapshot')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
              >
                Set Syncing
              </button>
              <button
                onClick={() => setConnectionState('disconnected')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                Set Offline
              </button>
            </div>
            
            <div className="p-4 bg-gray-900 rounded-lg">
              <ConnectionStatus connectionState={connectionState} />
            </div>
          </div>
        </section>

        {/* Resync Overlay Demo */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">2. Resync Overlay</h2>
          <p className="text-gray-400 mb-4">Blocking overlay during snapshot sync</p>
          
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {showOverlay ? 'Hide' : 'Show'} Overlay
          </button>
          
          {showOverlay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl px-8 py-6 flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                <div className="text-white text-lg font-semibold">Syncing Table State...</div>
              </div>
            </div>
          )}
        </section>

        {/* Pot Animation Demo */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">3. Pot Update Animation</h2>
          <p className="text-gray-400 mb-4">Scale and shake effect on pot updates</p>
          
          <div className="flex flex-col gap-4">
            <button
              onClick={() => {
                const pot = document.getElementById('demo-pot')
                if (pot) {
                  pot.classList.add('pot-update-animation')
                  setTimeout(() => pot.classList.remove('pot-update-animation'), 500)
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Trigger Pot Animation
            </button>
            
            <div className="flex justify-center p-8 bg-gray-900 rounded-lg">
              <div
                id="demo-pot"
                className="px-8 py-4 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl text-white text-2xl font-bold"
              >
                $500
              </div>
            </div>
          </div>
        </section>

        {/* Lobby Flash Animation Demo */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl">
          <h2 className="text-xl font-semibold text-white mb-4">4. Lobby Hot Table Pulse</h2>
          <p className="text-gray-400 mb-4">Flash effect when player count increases</p>
          
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setPlayerCount(prev => prev + 1)
                  const row = document.getElementById('demo-lobby-row')
                  if (row) {
                    row.classList.add('lobby-row-flash')
                    setTimeout(() => row.classList.remove('lobby-row-flash'), 600)
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Increase Player Count
              </button>
              <button
                onClick={() => {
                  setWaitlistCount(prev => prev + 1)
                  const row = document.getElementById('demo-lobby-row')
                  if (row) {
                    row.classList.add('lobby-row-flash')
                    setTimeout(() => row.classList.remove('lobby-row-flash'), 600)
                  }
                }}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
              >
                Increase Waitlist
              </button>
            </div>
            
            <div
              id="demo-lobby-row"
              className="bg-gray-900 rounded-lg p-4 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Demo Table</h3>
                  <div className="text-sm text-gray-400">No Limit Hold'em • $1/$2</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-bold text-white">
                    {playerCount}/9
                  </div>
                  <div className="text-xs text-gray-500">Players</div>
                  <div className="text-xs text-yellow-400">
                    +{waitlistCount} waiting
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="p-6 bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl border border-blue-500/30">
          <h2 className="text-xl font-semibold text-white mb-3">✅ Implementation Complete</h2>
          <ul className="text-gray-300 space-y-2">
            <li>• Enhanced ConnectionStatus with glassmorphism and Lucide icons</li>
            <li>• Resync overlay with backdrop blur for syncing_snapshot state</li>
            <li>• Delta-driven animation hook (useTableAnimations) with confetti support</li>
            <li>• Lobby hot table pulse animation on player count changes</li>
            <li>• All components integrate seamlessly with Phase 5 sync engine</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
