import { ReactNode } from 'react'

interface PokerFeltBackgroundProps {
  children: ReactNode
  className?: string
}

export default function PokerFeltBackground({ children, className }: PokerFeltBackgroundProps) {
  return (
    <div className={`fixed inset-0 h-full w-full overflow-hidden ${className ?? ''}`}>
      {/* Layer 1: Royal Emerald base with enhanced vignette - center bright, corners dark */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #00a565 0%, #008f58 25%, #003d29 50%, #001a12 75%, #000000 100%)' }} />

      {/* Layer 2: Poker suits line art pattern */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden focusable="false" role="presentation">
        <defs>
          <symbol id="suit-spade" viewBox="0 0 64 64">
            <path
              d="M32 6C26 13 12 20 12 32c0 7 5 13 12 14-4 2-6 5-6 9 0 4 3 7 7 7 3 0 5-2 5-5v-3h4v3c0 3 2 5 5 5 4 0 7-3 7-7 0-4-2-7-6-9 7-1 12-7 12-14 0-12-14-19-20-26Z"
            />
          </symbol>

          <symbol id="suit-heart" viewBox="0 0 64 64">
            <path d="M32 56S12 44 12 26c0-7 5-12 11-12 5 0 9 3 9 7 0-4 4-7 9-7 6 0 11 5 11 12 0 18-20 30-20 30Z" />
          </symbol>

          <symbol id="suit-club" viewBox="0 0 64 64">
            <path
              d="M32 8c-7 0-12 5-12 12 0 3 1 6 3 8-5 1-9 6-9 11 0 6 5 11 11 11 2 0 4-.4 6-1.3V58h-6v6h18v-6h-6v-9.3A11 11 0 0 0 45 40c6 0 11-5 11-11 0-5-4-10-9-11 2-2 3-5 3-8 0-7-5-12-12-12-4 0-7 2-8 4-1-2-4-4-8-4Z"
            />
          </symbol>

          <symbol id="suit-diamond" viewBox="0 0 64 64">
            <path d="M32 4 10 32l22 28 22-28Z" />
          </symbol>

          <pattern id="poker-suits-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(45 60 60)">
            <g stroke="white" strokeWidth="2" strokeOpacity="0.05" fill="none" strokeLinejoin="round" strokeLinecap="round">
              <use href="#suit-spade" x="12" y="12" width="32" height="32" />
              <use href="#suit-heart" x="76" y="12" width="32" height="32" />
              <use href="#suit-club" x="12" y="76" width="32" height="32" />
              <use href="#suit-diamond" x="76" y="76" width="32" height="32" />
            </g>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#poker-suits-pattern)" />
      </svg>

      {/* Layer 3: Enhanced glassy vignette to deepen edges and focus attention on center */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_25%,_rgba(0,0,0,0.4)_60%,_rgba(0,0,0,0.85)_100%)]" />

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
