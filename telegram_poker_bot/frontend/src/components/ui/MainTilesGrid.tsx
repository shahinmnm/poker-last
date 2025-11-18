import { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface MainTilesGridProps {
  children: ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * MainTilesGrid - Grid layout for main menu tiles
 * 
 * Creates a responsive 2-column grid with appropriate gaps.
 * Mobile-first approach with consistent spacing.
 */
export default function MainTilesGrid({ children, className }: MainTilesGridProps) {
  return (
    <div
      className={cn(
        'main-tiles-grid',
        className
      )}
    >
      {children}
    </div>
  )
}
