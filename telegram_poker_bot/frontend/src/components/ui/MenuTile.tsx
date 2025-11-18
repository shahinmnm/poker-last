import { forwardRef, type ComponentType, type HTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { cn } from '../../utils/cn'
import type { IconProps } from './icons'

export interface MenuTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ComponentType<IconProps> | IconDefinition
  title: string
  subtitle?: string
  label?: string
  badge?: string | number
  to: string
  recommended?: boolean
  quickTag?: string
  pulse?: boolean
  shine?: boolean
  depth?: boolean
  emoji?: string
  tileColor?: string
  gradientBg?: string
}

export const MenuTile = forwardRef<HTMLDivElement, MenuTileProps>(function MenuTile(
  { className, icon, title, subtitle, label, to, emoji, gradientBg, ...rest },
  ref,
) {
  // Check if icon is a Font Awesome icon definition
  const isFontAwesomeIcon = icon && typeof icon === 'object' && 'iconName' in icon

  return (
    <Link to={to} className="block">
      <div
        ref={ref}
        className={cn(
          'relative isolate flex h-[140px] w-full flex-col overflow-hidden',
          'border border-border bg-surface backdrop-blur-md',
          'transition-[transform,box-shadow] duration-[120ms] ease-out active:scale-95 active:shadow-none',
          className,
        )}
        style={{
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-soft)',
          padding: 'var(--space-lg)',
        }}
        {...rest}
      >
        {/* Gradient background overlay */}
        {gradientBg && (
          <div
            className="absolute inset-0 z-0 opacity-100"
            style={{
              background: gradientBg,
            }}
          />
        )}

        <div className="relative z-10 flex items-start justify-between">
          {label && (
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted opacity-80">
              {label}
            </span>
          )}
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-1.5 text-start" dir="auto">
          <h3 className="text-lg font-bold leading-tight text-text">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs leading-snug text-text-muted line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>

        {/* Icon in bottom-right */}
        {(icon || emoji) && (
          <div className="absolute bottom-4 right-4 z-10">
            {emoji && (
              <span className="text-2xl opacity-60">{emoji}</span>
            )}
            {icon && !emoji && isFontAwesomeIcon && (
              <FontAwesomeIcon 
                icon={icon as IconDefinition} 
                className="text-2xl text-text-muted/40"
              />
            )}
            {icon && !emoji && !isFontAwesomeIcon && typeof icon === 'function' && (() => {
              const IconComponent = icon as ComponentType<IconProps>
              return <IconComponent className="h-6 w-6 opacity-40" />
            })()}
          </div>
        )}
      </div>
    </Link>
  )
})

export default MenuTile
