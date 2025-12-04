/**
 * ChipFly component - renders micro-animations for chip movements
 * Uses CSS keyframes for simple translate + fade effects
 */

import { useEffect, useState } from 'react'

export interface ChipAnimation {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  onComplete?: () => void
}

interface ChipFlyProps {
  animation: ChipAnimation
}

export function ChipFly({ animation }: ChipFlyProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger animation on mount
    setMounted(true)

    // Clean up after animation completes
    const timer = setTimeout(() => {
      animation.onComplete?.()
    }, 350) // Slightly longer than animation duration to ensure completion

    return () => clearTimeout(timer)
  }, [animation])

  const deltaX = animation.toX - animation.fromX
  const deltaY = animation.toY - animation.fromY

  return (
    <div
      className="chip-fly-container"
      style={{
        position: 'fixed',
        left: `${animation.fromX}px`,
        top: `${animation.fromY}px`,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        className={`chip-fly ${mounted ? 'chip-fly-animate' : ''}`}
        style={{
          '--chip-translate-x': `${deltaX}px`,
          '--chip-translate-y': `${deltaY}px`,
        } as React.CSSProperties}
      >
        <div className="chip-stack">
          <div className="chip chip-top" />
          <div className="chip chip-mid" />
          <div className="chip chip-bot" />
        </div>
      </div>
      <style>{`
        .chip-fly {
          transform: translate(0, 0);
          opacity: 1;
        }
        
        .chip-fly-animate {
          animation: chipFlyMove 300ms ease-out forwards;
        }
        
        @keyframes chipFlyMove {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(var(--chip-translate-x), var(--chip-translate-y));
            opacity: 0;
          }
        }
        
        .chip-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        
        .chip {
          width: 20px;
          height: 6px;
          border-radius: 50%;
          border: 1px solid rgba(234, 179, 8, 0.8);
        }
        
        .chip-top {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .chip-mid {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        .chip-bot {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  )
}

interface ChipFlyManagerProps {
  animations: ChipAnimation[]
  onAnimationComplete: (id: string) => void
}

export function ChipFlyManager({ animations, onAnimationComplete }: ChipFlyManagerProps) {
  return (
    <>
      {animations.map((animation) => (
        <ChipFly
          key={animation.id}
          animation={{
            ...animation,
            onComplete: () => onAnimationComplete(animation.id),
          }}
        />
      ))}
    </>
  )
}
