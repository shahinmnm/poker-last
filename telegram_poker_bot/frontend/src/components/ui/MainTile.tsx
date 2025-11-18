import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import GlassCard from './GlassCard'
import { cn } from '../../utils/cn'

export interface MainTileProps {
  /**
   * Small label above the title (e.g., "CASH GAME")
   */
  label: string
  /**
   * Main title of the tile (e.g., "Quick Match")
   */
  title: string
  /**
   * Subtitle/description (e.g., "Fast seat at best table")
   */
  subtitle: string
  /**
   * FontAwesome icon
   */
  icon: IconDefinition
  /**
   * Accent gradient for this tile (format: "from-color to-color")
   * Examples:
   * - Quick Match: "rgb(139, 92, 246) rgb(236, 72, 153)" (violet → pink)
   * - Private Table: "rgb(239, 68, 68) rgb(249, 115, 22)" (red → orange)
   * - Tournaments: "rgb(251, 191, 36) rgb(217, 119, 6)" (gold → copper)
   * - Practice Mode: "rgb(59, 130, 246) rgb(139, 92, 246)" (blue → violet)
   */
  accentGradient: string
  /**
   * Click handler
   */
  onClick?: () => void
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * MainTile - Individual tile for the main menu mosaic
 * 
 * Built on top of GlassCard with specific layout and styling for menu items.
 * Each tile has a unique accent color gradient that affects borders and hover glow.
 */
export default function MainTile({
  label,
  title,
  subtitle,
  icon,
  accentGradient,
  onClick,
  className,
}: MainTileProps) {
  return (
    <GlassCard
      radius="lg"
      blur={18}
      accentGradient={accentGradient}
      hover={true}
      pressable={true}
      onClick={onClick}
      className={cn(
        'main-tile cursor-pointer select-none',
        className
      )}
    >
      <div className="main-tile__content">
        {/* Upper text section */}
        <div className="main-tile__text">
          <div className="main-tile__label">
            {label}
          </div>
          <div className="main-tile__title">
            {title}
          </div>
          <div className="main-tile__subtitle">
            {subtitle}
          </div>
        </div>

        {/* Icon in bottom-right */}
        <div className="main-tile__icon">
          <FontAwesomeIcon icon={icon} />
        </div>
      </div>
    </GlassCard>
  )
}
