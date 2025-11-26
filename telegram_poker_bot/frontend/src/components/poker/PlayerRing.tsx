import { ReactNode, useMemo } from 'react'

export interface PlayerRingEntry {
  id: string
  node: ReactNode
  seatIndex?: number
  isHero?: boolean
}

export interface PlayerRingProps {
  players: PlayerRingEntry[]
  slotCount?: number
  heroSeatIndex?: number | null
  className?: string
}

/**
 * PlayerRing - Positions players using polar coordinates
 * Always renders hero at bottom center (6 o'clock) regardless of logical seat index
 */
export default function PlayerRing({
  players,
  slotCount,
  heroSeatIndex,
  className = '',
}: PlayerRingProps) {
  const totalSlots = Math.max(slotCount ?? players.length + 1, 2)

  const positioned = useMemo(() => {
    const heroSeat = heroSeatIndex ?? 0
    
    // Position mapping for different table sizes (inside useMemo to avoid dependency issues)
    const positionLayouts: Record<number, Array<{ left: string; top: string }>> = {
      2: [
        // Heads-up: villain at top
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
        // 6-max: standard poker table
        { left: '18%', top: '72%' },  // Bottom left
        { left: '82%', top: '72%' },  // Bottom right
        { left: '22%', top: '28%' },  // Top left
        { left: '78%', top: '28%' },  // Top right
        { left: '50%', top: '18%' },  // Top center
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
    
    const layout = positionLayouts[Math.min(Math.max(totalSlots, 2), 8)]

    if (!layout) {
      return players.map((entry) => ({
        ...entry,
        position: { left: '50%', top: '50%' },
      }))
    }

    return players.map((entry, index) => {
      const seatIndex = entry.seatIndex ?? index + 1
      
      // Calculate relative position (rotate so hero is at bottom)
      const relativeIndex = ((seatIndex - heroSeat + totalSlots) % totalSlots) || totalSlots
      
      // Get position from layout (subtract 1 because hero is not in the layout)
      // Ensure index is within bounds
      const layoutIndex = Math.max(0, Math.min(relativeIndex - 1, layout.length - 1))
      const position = layout[layoutIndex] ?? {
        left: '50%',
        top: '20%',
      }

      return {
        ...entry,
        position,
      }
    })
  }, [heroSeatIndex, players, totalSlots])

  return (
    <div className={`absolute inset-0 ${className}`}>
      {positioned.map((entry) => (
        <div
          key={entry.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
            entry.isHero ? 'z-30' : 'z-10'
          }`}
          style={{
            left: entry.position.left,
            top: entry.position.top,
          }}
        >
          {entry.node}
        </div>
      ))}
    </div>
  )
}
