import { ReactNode } from 'react'
import { pokerTokens } from '@/design/tokens'

export interface TableRingProps {
  children?: ReactNode
  className?: string
}

/**
 * TableRing - The outer glowing ring and inner table surface
 * Provides the stadium-shaped table with gradient stroke
 */
export default function TableRing({ children, className = '' }: TableRingProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Outer glowing ring */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '85%',
          height: '60%',
          maxWidth: '800px',
          maxHeight: '480px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${pokerTokens.colors.tableRing.outerFrom} 0%, ${pokerTokens.colors.tableRing.outerTo} 100%)`,
          border: `3px solid ${pokerTokens.colors.tableRing.stroke}`,
          boxShadow: `
            0 0 60px ${pokerTokens.colors.tableRing.stroke},
            inset 0 0 40px rgba(20, 99, 187, 0.15)
          `,
        }}
      />

      {/* Inner table surface */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '80%',
          height: '54%',
          maxWidth: '750px',
          maxHeight: '430px',
          borderRadius: '50%',
          background: pokerTokens.colors.tableRing.inner,
          backdropFilter: `blur(${pokerTokens.effects.blur.md})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
