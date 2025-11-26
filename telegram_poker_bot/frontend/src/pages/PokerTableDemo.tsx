import { useState } from 'react'
import {
  TableLayout,
  PlayerRing,
  Seat,
  PotDisplay,
  CommunityCards,
  ActionBar,
  BetPill,
} from '@/components/poker'
import type { PlayerRingEntry } from '@/components/poker'
import type { AllowedAction } from '@/types/game'

/**
 * PokerTableDemo - Demonstration of the redesigned poker table UI
 * Shows all components working together in various states
 */
export default function PokerTableDemo() {
  const [activeDemo, setActiveDemo] = useState<'6max' | 'headsup' | 'folded'>('6max')
  const [currentActorSeat, setCurrentActorSeat] = useState(2)

  // Demo data for 6-max table
  const players6Max: PlayerRingEntry[] = [
    {
      id: 'player-1',
      seatIndex: 1,
      node: (
        <div className="flex flex-col items-center gap-2">
          <Seat
            variant="active"
            name="Alice"
            chipStack={2500}
            seatNumber={1}
            positionLabel="BTN"
            isMyTurn={currentActorSeat === 1}
          />
          <BetPill amount={100} />
        </div>
      ),
    },
    {
      id: 'player-2',
      seatIndex: 2,
      node: (
        <div className="flex flex-col items-center gap-2">
          <Seat
            variant="active"
            name="Bob"
            chipStack={3200}
            seatNumber={2}
            positionLabel="SB"
            isMyTurn={currentActorSeat === 2}
          />
          <BetPill amount={50} />
        </div>
      ),
    },
    {
      id: 'player-3',
      seatIndex: 3,
      node: (
        <div className="flex flex-col items-center gap-2">
          <Seat
            variant="active"
            name="Charlie"
            chipStack={1800}
            seatNumber={3}
            positionLabel="BB"
            isMyTurn={currentActorSeat === 3}
          />
          <BetPill amount={100} />
        </div>
      ),
    },
    {
      id: 'player-4',
      seatIndex: 4,
      node: (
        <Seat
          variant="folded"
          name="Diana"
          chipStack={4500}
          seatNumber={4}
          statusPill="FOLD"
        />
      ),
    },
    {
      id: 'empty-5',
      seatIndex: 5,
      node: (
        <Seat
          variant="empty"
          seatNumber={5}
          onClick={() => console.log('Clicked empty seat 5')}
        />
      ),
    },
  ]

  // Demo data for heads-up
  const playersHeadsUp: PlayerRingEntry[] = [
    {
      id: 'villain',
      seatIndex: 1,
      node: (
        <div className="flex flex-col items-center gap-2">
          <Seat
            variant="active"
            name="Villain"
            chipStack={5000}
            seatNumber={1}
            positionLabel="BTN"
            isMyTurn={currentActorSeat === 1}
          />
          <BetPill amount={200} />
        </div>
      ),
    },
  ]

  // Demo allowed actions
  const allowedActions: AllowedAction[] = [
    { action_type: 'fold' },
    { action_type: 'call', amount: 200 },
    { action_type: 'raise', min_amount: 400, max_amount: 5000 },
  ]

  const handleAction = (action: string, amount?: number) => {
    console.log('Action:', action, amount)
  }

  return (
    <div className="min-h-screen">
      {/* Demo controls */}
      <div className="fixed left-4 top-4 z-50 flex flex-col gap-2">
        <button
          onClick={() => setActiveDemo('6max')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeDemo === '6max'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          6-Max Table
        </button>
        <button
          onClick={() => setActiveDemo('headsup')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeDemo === 'headsup'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          Heads-Up
        </button>
        <button
          onClick={() => setActiveDemo('folded')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeDemo === 'folded'
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/70'
          }`}
        >
          Folded States
        </button>
      </div>

      {/* Actor controls */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        <span className="text-xs font-semibold text-white/70">
          Active Player:
        </span>
        {[0, 1, 2, 3].map((seat) => (
          <button
            key={seat}
            onClick={() => setCurrentActorSeat(seat)}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${
              currentActorSeat === seat
                ? 'bg-cyan-500 text-white'
                : 'bg-white/10 text-white/70'
            }`}
          >
            Seat {seat}
          </button>
        ))}
      </div>

      {/* Table layout */}
      <TableLayout
        infoPill={
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl">
            Demo Table • SB/BB: 50/100 • {activeDemo === 'headsup' ? 'Heads-Up' : '6-Max'}
          </div>
        }
        board={
          <div className="flex flex-col items-center gap-4">
            <PotDisplay
              mainPot={650}
              sidePots={[
                { amount: 200, label: 'Side Pot 1' },
              ]}
            />
            <CommunityCards
              cards={['Ah', 'Kd', 'Qc', 'Jh', 'Ts']}
              highlightedCards={['Ah', 'Kd', 'Qc']}
            />
          </div>
        }
        players={
          <PlayerRing
            players={activeDemo === 'headsup' ? playersHeadsUp : players6Max}
            slotCount={activeDemo === 'headsup' ? 2 : 6}
            heroSeatIndex={0}
          />
        }
        hero={
          <div className="flex flex-col items-center gap-2">
            <Seat
              variant="hero"
              name="You (Hero)"
              chipStack={5000}
              seatNumber={0}
              isMyTurn={currentActorSeat === 0}
            />
            <BetPill amount={100} />
          </div>
        }
        action={
          <ActionBar
            allowedActions={allowedActions}
            onAction={handleAction}
            isProcessing={false}
            potSize={650}
            myStack={5000}
            isMyTurn={currentActorSeat === 0}
          />
        }
      />

      {/* Legend */}
      <div className="fixed bottom-4 left-4 z-50 rounded-lg border border-white/20 bg-black/60 p-3 text-xs text-white/70 backdrop-blur-xl">
        <div className="font-semibold text-white/90">Component Features:</div>
        <ul className="mt-1 space-y-0.5">
          <li>✓ Hero always at bottom center</li>
          <li>✓ Turn ring animation on active player</li>
          <li>✓ Glassmorphism design</li>
          <li>✓ Bet pills near players</li>
          <li>✓ Enhanced action bar colors</li>
          <li>✓ Card reveal animations</li>
        </ul>
      </div>
    </div>
  )
}
