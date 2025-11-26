import { ReactNode, useMemo } from 'react'

interface PlayerRingEntry {
  id: string
  node: ReactNode
  seatIndex?: number
  isHero?: boolean
}

interface PlayerRingProps {
  players: PlayerRingEntry[]
  slotCount?: number
  heroSeatIndex?: number | null
}

interface Position {
  left: string
  top: string
  scale?: number
}

const positionsByTable: Record<number, Position[]> = {
  2: [
    { left: '50%', top: '24%' },
  ],
  3: [
    { left: '24%', top: '38%' },
    { left: '76%', top: '38%' },
  ],
  4: [
    { left: '22%', top: '44%' },
    { left: '78%', top: '44%' },
    { left: '50%', top: '20%' },
  ],
  5: [
    { left: '20%', top: '56%' },
    { left: '80%', top: '56%' },
    { left: '26%', top: '28%' },
    { left: '74%', top: '28%' },
  ],
  6: [
    { left: '18%', top: '72%' },
    { left: '82%', top: '72%' },
    { left: '22%', top: '28%' },
    { left: '78%', top: '28%' },
    { left: '50%', top: '18%' },
  ],
  7: [
    { left: '18%', top: '70%' },
    { left: '82%', top: '70%' },
    { left: '12%', top: '48%' },
    { left: '88%', top: '48%' },
    { left: '24%', top: '26%' },
    { left: '76%', top: '26%' },
    { left: '50%', top: '16%' },
  ],
  8: [
    { left: '18%', top: '70%' },
    { left: '82%', top: '70%' },
    { left: '12%', top: '48%' },
    { left: '88%', top: '48%' },
    { left: '10%', top: '30%' },
    { left: '90%', top: '30%' },
    { left: '34%', top: '18%' },
    { left: '66%', top: '18%' },
  ],
}

const pickPosition = (relativeIndex: number, totalSlots: number): Position => {
  const layout = positionsByTable[Math.min(Math.max(totalSlots, 2), 8)]
  return layout[Math.max(0, Math.min(relativeIndex - 1, layout.length - 1))] ?? { left: '50%', top: '20%' }
}

export default function PlayerRing({ players, slotCount, heroSeatIndex }: PlayerRingProps) {
  const totalSlots = Math.max(slotCount ?? players.length + 1, 2)

  const positioned = useMemo(() => {
    const heroSeat = heroSeatIndex ?? 0

    return players.map((entry, index) => {
      const seatIndex = entry.seatIndex ?? index + 1
      const relativeIndex = ((seatIndex - heroSeat + totalSlots) % totalSlots) || totalSlots
      return {
        ...entry,
        position: pickPosition(relativeIndex, totalSlots),
      }
    })
  }, [heroSeatIndex, players, totalSlots])

  return (
    <div className="absolute inset-0 z-10">
      {positioned.map((entry) => (
        <div
          key={entry.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${entry.isHero ? 'z-30' : ''}`}
          style={{ left: entry.position.left, top: entry.position.top, scale: entry.position.scale }}
        >
          {entry.node}
        </div>
      ))}
    </div>
  )
}
