/**
 * PokerTableLayout - Immersive poker table arena layout
 * 
 * This component provides a full-screen poker table layout with:
 * - Radial gradient background simulating poker table felt
 * - Absolute positioned areas for opponents (top), hero (bottom), and board (center)
 * - Transparent status bar at the top
 */

import { ReactNode } from 'react'

export interface PokerTableLayoutProps {
  /** Status bar content (table info, connection status) */
  statusBar?: ReactNode
  /** Opponent players area content */
  opponents?: ReactNode
  /** Community board area content */
  board?: ReactNode
  /** Hero (current player) area content */
  hero?: ReactNode
  /** Optional children (alternative to specific props) */
  children?: ReactNode
}

export default function PokerTableLayout({
  statusBar,
  opponents,
  board,
  hero,
  children,
}: PokerTableLayoutProps) {
  return (
    <div 
      className="fixed inset-0 overflow-hidden"
      style={{
        height: 'calc(100vh - env(safe-area-inset-bottom))',
        background: 'radial-gradient(ellipse at center, #1a472a 0%, #0d291a 100%)',
      }}
    >
      {/* Transparent Status Bar - Top */}
      {statusBar && (
        <div className="absolute top-0 left-0 right-0 z-50 px-4 py-2 bg-black/20 backdrop-blur-sm border-b border-white/10">
          {statusBar}
        </div>
      )}

      {/* Opponents Area - Top (10-15% from top) */}
      {opponents && (
        <div className="absolute top-[12%] left-0 right-0 z-10 px-4">
          {opponents}
        </div>
      )}

      {/* Board Area - Center */}
      {board && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          {board}
        </div>
      )}

      {/* Hero Area - Bottom (above controls) */}
      {hero && (
        <div className="absolute left-0 right-0 z-10 px-4" style={{ bottom: 'var(--bottom-nav-height, 72px)' }}>
          {hero}
        </div>
      )}

      {/* Alternative: render children if no specific areas provided */}
      {children}
    </div>
  )
}
