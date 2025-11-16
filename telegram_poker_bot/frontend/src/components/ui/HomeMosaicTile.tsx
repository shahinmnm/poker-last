import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../../utils/cn'
import Badge from './Badge'

export interface HomeMosaicTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: ReactNode
  title: string
  subtitle?: string
  badge?: string | number
  to: string
}

export const HomeMosaicTile = forwardRef<HTMLDivElement, HomeMosaicTileProps>(
  function HomeMosaicTile(
    { className, icon, title, subtitle, badge, to, ...rest },
    ref,
  ) {
    return (
      <Link to={to} className="block">
        <div
          ref={ref}
          className={cn(
            'group relative overflow-hidden rounded-3xl p-5 transition-all duration-200',
            'bg-[color:var(--surface-overlay)] backdrop-blur-sm',
            'border border-[color:var(--surface-border)]',
            'hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(34,197,94,0.2)]',
            'active:translate-y-0',
            'min-h-[160px] flex flex-col',
            className,
          )}
          {...rest}
        >
          {/* Accent top border */}
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-[2px]',
              'bg-gradient-to-r from-transparent via-[color:var(--accent-start)] to-transparent',
              'opacity-60 group-hover:opacity-100 transition-opacity',
            )}
          />

          {/* Icon container - glassy iOS style */}
          <div className="mb-3 flex items-start justify-between">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl text-2xl',
                'bg-gradient-to-br from-[color:var(--accent-soft)] to-transparent',
                'backdrop-blur-md border border-[color:var(--surface-border)]',
                'shadow-[0_4px_12px_rgba(34,197,94,0.15)]',
                'transition-all duration-200',
                'group-hover:scale-110 group-hover:shadow-[0_6px_20px_rgba(34,197,94,0.25)]',
              )}
            >
              {icon}
            </div>
            {badge !== undefined && (
              <Badge variant="primary" size="sm">
                {badge}
              </Badge>
            )}
          </div>

          {/* Text content - flex-grow to fill remaining space */}
          <div className="flex-grow flex flex-col justify-center">
            <h3 className="text-base font-semibold text-[color:var(--text-primary)] group-hover:text-[color:var(--accent-end)] transition-colors">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-xs text-[color:var(--text-muted)] line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>

          {/* Hover glow effect */}
          <div
            className={cn(
              'absolute inset-0 rounded-3xl opacity-0 transition-opacity pointer-events-none',
              'group-hover:opacity-100',
              'bg-gradient-to-br from-[color:var(--accent-soft)] to-transparent',
            )}
          />
        </div>
      </Link>
    )
  },
)

export default HomeMosaicTile
