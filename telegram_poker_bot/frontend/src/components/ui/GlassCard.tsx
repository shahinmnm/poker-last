import { ReactNode, HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface GlassCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: ReactNode
  /**
   * Border radius size
   * @default 'lg'
   */
  radius?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Blur intensity in px
   * @default 18
   */
  blur?: number
  /**
   * Accent color gradient for the card (used in border and hover glow)
   * Format: 'from-color to-color' (CSS gradient colors)
   * @default null
   */
  accentGradient?: string
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Enable hover glow effect
   * @default true
   */
  hover?: boolean
  /**
   * Active press scale effect
   * @default false
   */
  pressable?: boolean
}

const radiusMap = {
  sm: 'rounded-xl',
  md: 'rounded-[1.5rem]', // 24px - larger for glassmorphism
  lg: 'rounded-[2rem]',   // 32px - larger for glassmorphism
  xl: 'rounded-3xl',
}

/**
 * GlassCard - A reusable glassmorphism card component inspired by glass_kit
 * 
 * Features:
 * - Translucent gradient background
 * - Backdrop filter blur
 * - Gradient border (white → transparent → accent)
 * - Diagonal inner highlight layer
 * - Soft shadow
 * - Optional hover glow
 * - Light/dark mode support
 */
export default function GlassCard({
  children,
  radius = 'lg',
  blur = 24,
  accentGradient,
  className,
  hover = true,
  pressable = false,
  style,
  ...props
}: GlassCardProps) {
  const borderRadiusClass = radiusMap[radius]

  // Generate custom CSS variables for this card instance
  const customStyle = {
    '--glass-blur': `${blur}px`,
    ...(accentGradient && {
      '--glass-accent-from': accentGradient.split(' ')[0],
      '--glass-accent-to': accentGradient.split(' ')[1] || accentGradient.split(' ')[0],
    }),
    ...style,
  } as React.CSSProperties

  return (
    <div
      className={cn(
        'glass-card group relative overflow-hidden',
        borderRadiusClass,
        hover && 'glass-card--hover',
        pressable && 'glass-card--pressable',
        className
      )}
      style={customStyle}
      {...props}
    >
      {/* Border gradient layer */}
      <div className="glass-card__border" />
      
      {/* Inner highlight - diagonal gradient from top-left */}
      <div className="glass-card__highlight" />
      
      {/* Content */}
      <div className="glass-card__content relative z-10">
        {children}
      </div>
    </div>
  )
}
