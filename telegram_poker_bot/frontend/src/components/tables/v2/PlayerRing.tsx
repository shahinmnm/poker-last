import { ReactNode, useMemo } from 'react'

interface PlayerRingEntry {
  id: string
  node: ReactNode
  isHero?: boolean
}

interface PlayerRingProps {
  players: PlayerRingEntry[]
  slotCount?: number
}

interface Position {
  left: string
  top: string
  scale?: number
}

const positionMap = (index: number, count: number): Position => {
  const slots: Record<number, Position[]> = {
    2: [
      { left: '50%', top: '18%' },
    ],
    3: [
      { left: '30%', top: '16%' },
      { left: '70%', top: '16%' },
    ],
    4: [
      { left: '20%', top: '22%' },
      { left: '50%', top: '12%' },
      { left: '80%', top: '22%' },
    ],
    5: [
      { left: '20%', top: '28%' },
      { left: '50%', top: '12%' },
      { left: '80%', top: '28%' },
      { left: '10%', top: '52%' },
    ],
    6: [
      { left: '16%', top: '30%' },
      { left: '50%', top: '12%' },
      { left: '84%', top: '30%' },
      { left: '8%', top: '55%' },
      { left: '92%', top: '55%' },
    ],
    7: [
      { left: '12%', top: '32%' },
      { left: '42%', top: '15%' },
      { left: '58%', top: '15%' },
      { left: '88%', top: '32%' },
      { left: '8%', top: '57%' },
      { left: '92%', top: '57%' },
    ],
    8: [
      { left: '12%', top: '34%' },
      { left: '35%', top: '18%' },
      { left: '65%', top: '18%' },
      { left: '88%', top: '34%' },
      { left: '10%', top: '58%' },
      { left: '40%', top: '66%' },
      { left: '60%', top: '66%' },
      { left: '90%', top: '58%' },
    ],
  }

  const positions = slots[Math.min(Math.max(count, 2), 8)]
  const selected = positions[Math.min(index, positions.length - 1)] || { left: '50%', top: '20%' }
  return selected
}

export default function PlayerRing({ players, slotCount }: PlayerRingProps) {
  const totalSlots = Math.max(slotCount ?? players.length + 1, 2)
  const positioned = useMemo(
    () =>
      players.map((entry, index) => ({
        ...entry,
        position: positionMap(index, totalSlots),
      })),
    [players, totalSlots],
  )

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
