import { ReactNode } from 'react'
import { pokerTokens } from '@/design/tokens'

export interface TableLayoutProps {
  infoPill?: ReactNode
  board?: ReactNode
  players?: ReactNode
  hero?: ReactNode
  action?: ReactNode
  overlays?: ReactNode
  className?: string
}

/**
 * TableLayout - Enhanced table layout with blue glassmorphism background
 * Uses a 4:3 aspect ratio container with position: relative for polar coordinates
 */
export default function TableLayout({
  infoPill,
  board,
  players,
  hero,
  action,
  overlays,
  className = '',
}: TableLayoutProps) {
  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden ${className}`}
      style={{
        background: pokerTokens.colors.root,
        minHeight: 'calc(100vh - env(safe-area-inset-bottom))',
      }}
    >
      {/* Blue gradient background with radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(110% 80% at 50% 35%, rgba(46, 118, 255, 0.14) 0%, rgba(11, 26, 60, 0.9) 50%, rgba(5, 8, 22, 0.98) 100%),
            linear-gradient(180deg, ${pokerTokens.colors.root} 0%, ${pokerTokens.colors.rootAlt} 80%)
          `,
        }}
      />

      {/* Table ring / neon arc */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-[48%]"
        style={{
          width: '110vw',
          height: '70vh',
          borderRadius: '999px',
          border: '1px solid rgba(59, 130, 246, 0.1)',
          background: `
            radial-gradient(70% 60% at 50% 55%, rgba(38, 92, 199, 0.18) 0%, rgba(6, 14, 31, 0.8) 60%, rgba(5, 8, 22, 0.9) 100%)
          `,
          boxShadow: `
            0 0 90px rgba(64, 174, 255, 0.18),
            inset 0 0 40px rgba(20, 99, 187, 0.12)
          `,
          backdropFilter: `blur(${pokerTokens.effects.blur.lg})`,
        }}
      />

      {/* Info pill (top) */}
      {infoPill && (
        <div className="absolute inset-x-4 top-4 z-40 flex justify-end sm:justify-center">
          {infoPill}
        </div>
      )}

      {/* Players ring */}
      {players && <div className="absolute inset-0 z-10">{players}</div>}

      {/* Board & pot (center) */}
      {board && (
        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          {board}
        </div>
      )}

      {/* Hero (bottom center) */}
      {hero && (
        <div className="absolute bottom-[18%] left-1/2 z-30 -translate-x-1/2">
          {hero}
        </div>
      )}

      {/* Action bar (bottom) */}
      {action && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
          {action}
        </div>
      )}

      {/* Overlays (modals, winner showcase, etc.) */}
      {overlays}
    </div>
  )
}
