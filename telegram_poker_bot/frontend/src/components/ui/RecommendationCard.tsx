import { Link } from 'react-router-dom'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { cn } from '../../utils/cn'

interface RecommendationCardProps {
  title: string
  subtitle: string
  icon?: IconDefinition
  to: string
  className?: string
}

export function RecommendationCard({ title, subtitle, icon, to, className }: RecommendationCardProps) {
  return (
    <Link to={to} className={cn('block', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-4 px-5 py-4',
          'rounded-2xl border border-border/50',
          'shadow-soft transition-all duration-200',
          'hover:shadow-elevated active:scale-[0.98]'
        )}
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Next action</p>
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
        {icon && (
          <div 
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'var(--color-accent-soft)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <FontAwesomeIcon icon={icon} className="text-xl text-accent" />
          </div>
        )}
      </div>
    </Link>
  )
}

export default RecommendationCard
