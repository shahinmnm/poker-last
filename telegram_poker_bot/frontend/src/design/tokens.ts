/**
 * Poker Table Design Tokens
 * Tokenized design system for the Telegram Mini App poker table UI
 */

export const pokerTokens = {
  // ==================== COLORS ====================
  colors: {
    // Backgrounds
    root: '#050816',
    rootAlt: '#071225',
    
    // Table ring gradients
    tableRing: {
      outerFrom: 'rgba(59, 130, 246, 0.4)',
      outerTo: 'rgba(11, 26, 60, 0.9)',
      inner: 'rgba(5, 8, 22, 0.95)',
      stroke: 'rgba(38, 92, 199, 0.6)',
    },
    
    // Glass surfaces
    glass: {
      seat: 'rgba(12, 24, 64, 0.72)',
      card: 'rgba(255, 255, 255, 0.05)',
      actionBar: 'rgba(255, 255, 255, 0.05)',
      pill: 'rgba(11, 26, 60, 0.85)',
    },
    
    // Primary/Secondary
    primary: {
      base: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    secondary: {
      base: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
    },
    
    // CTA (Call-to-Action)
    cta: {
      base: '#f97316',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
      hover: '#ea580c',
    },
    
    // Success/Danger
    success: {
      base: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a',
    },
    danger: {
      base: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    
    // Text colors
    text: {
      high: 'rgba(255, 255, 255, 0.98)',
      medium: 'rgba(255, 255, 255, 0.80)',
      muted: 'rgba(255, 255, 255, 0.60)',
      disabled: 'rgba(255, 255, 255, 0.40)',
    },
    
    // Border colors
    border: {
      subtle: 'rgba(255, 255, 255, 0.10)',
      normal: 'rgba(255, 255, 255, 0.20)',
      strong: 'rgba(255, 255, 255, 0.30)',
    },
    
    // State-specific colors
    states: {
      // Seat states
      hero: {
        // Note: This gradient should be implemented using background-image or pseudo-elements
        // as CSS border property doesn't support gradients directly
        borderGradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
        glow: 'rgba(59, 130, 246, 0.4)',
      },
      active: {
        // Note: Use this for background-image on ring element
        ringGradient: 'linear-gradient(135deg, #06b6d4 0%, #f97316 100%)',
        glow: 'rgba(6, 182, 212, 0.6)',
      },
      folded: {
        overlay: 'rgba(0, 0, 0, 0.45)',
        border: 'rgba(100, 116, 139, 0.3)',
      },
      empty: {
        border: 'rgba(255, 255, 255, 0.2)',
        borderActive: 'rgba(6, 182, 212, 0.5)',
      },
      
      // Chip colors
      chip: {
        text: '#ffffff',
        bg: 'rgba(11, 26, 60, 0.9)',
      },
    },
    
    // Pot display
    pot: {
      bg: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
      text: '#ffffff',
      border: 'rgba(249, 115, 22, 0.4)',
    },
  },
  
  // ==================== TYPOGRAPHY ====================
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    
    fontSize: {
      xs: '0.625rem',    // 10px
      sm: '0.75rem',     // 12px
      md: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      xxl: '1.5rem',     // 24px
    },
    
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  // ==================== SPACING ====================
  spacing: {
    xxs: '0.25rem',   // 4px
    xs: '0.5rem',     // 8px
    sm: '0.75rem',    // 12px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    xxl: '3rem',      // 48px
  },
  
  // ==================== RADII ====================
  radii: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    pill: '9999px',   // full rounded
    circle: '50%',    // circle
  },
  
  // ==================== EFFECTS ====================
  effects: {
    // Blur radii
    blur: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      xxl: '24px',
    },
    
    // Shadows
    shadow: {
      surface: '0 4px 12px rgba(0, 0, 0, 0.15)',
      seat: '0 8px 24px rgba(0, 0, 0, 0.25)',
      elevated: '0 12px 32px rgba(0, 0, 0, 0.35)',
      glow: {
        primary: '0 0 20px rgba(59, 130, 246, 0.5)',
        cta: '0 0 20px rgba(249, 115, 22, 0.5)',
        active: '0 0 30px rgba(6, 182, 212, 0.6)',
      },
    },
  },
  
  // ==================== ANIMATION TOKENS ====================
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
      cardDeal: '400ms',
      chipMove: '800ms',
      glowPulse: '2000ms',
    },
    
    easing: {
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      outExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
    },
  },
  
  // ==================== LAYOUT TOKENS ====================
  layout: {
    // Polar coordinates for 6-max table (relative to hero at bottom)
    seats6Max: [
      { angle: 0, radius: 0.75, label: 'hero' },      // Bottom center (hero)
      { angle: 240, radius: 0.68, label: 'seat-1' },  // Bottom left
      { angle: 300, radius: 0.68, label: 'seat-2' },  // Bottom right
      { angle: 150, radius: 0.75, label: 'seat-3' },  // Top left
      { angle: 210, radius: 0.75, label: 'seat-4' },  // Top right
      { angle: 180, radius: 0.82, label: 'seat-5' },  // Top center
    ],
    
    // Polar coordinates for heads-up table
    seatsHeadsUp: [
      { angle: 0, radius: 0.75, label: 'hero' },      // Bottom center (hero)
      { angle: 180, radius: 0.82, label: 'villain' }, // Top center
    ],
    
    // Table aspect ratio
    aspectRatio: {
      desktop: 4 / 3,
      mobile: 3 / 4,
    },
    
    // Seat sizes
    seatSize: {
      desktop: {
        avatar: 72,  // px
        hero: 80,    // px (slightly larger)
      },
      mobile: {
        avatar: 52,  // px
        hero: 60,    // px
      },
    },
  },
} as const

export type PokerTokens = typeof pokerTokens

// Helper function to convert polar to cartesian coordinates
export function polarToCartesian(
  angle: number,
  radius: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; top: string; left: string } {
  // Convert angle to radians (0° = bottom, increases counter-clockwise)
  const rad = ((angle - 90) * Math.PI) / 180
  
  // Calculate center position
  const centerX = containerWidth / 2
  const centerY = containerHeight / 2
  
  // Calculate position
  const x = centerX + radius * containerWidth * 0.4 * Math.cos(rad)
  const y = centerY + radius * containerHeight * 0.4 * Math.sin(rad)
  
  return {
    x,
    y,
    // CSS positioning (with transform translate)
    left: `${(x / containerWidth) * 100}%`,
    top: `${(y / containerHeight) * 100}%`,
  }
}

// Helper to get seat positions for a given table size
export function getSeatPositions(
  maxPlayers: number,
  heroSeatIndex: number,
  containerWidth = 800,
  containerHeight = 600
) {
  const layout = maxPlayers === 2 ? pokerTokens.layout.seatsHeadsUp : pokerTokens.layout.seats6Max
  
  return layout.map((seat, index) => {
    // Rotate positions so hero is always at bottom
    const relativeIndex = (index - heroSeatIndex + maxPlayers) % maxPlayers
    const adjustedSeat = layout[relativeIndex] || seat
    
    return {
      ...polarToCartesian(adjustedSeat.angle, adjustedSeat.radius, containerWidth, containerHeight),
      label: adjustedSeat.label,
      index: relativeIndex,
    }
  })
}
