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
          'border border-white/20',
          'transition-[transform,box-shadow] duration-[120ms] ease-out active:scale-[0.97] active:shadow-none',
          className,
        )}
        style={{
          borderRadius: 'var(--radius-tile)',
          boxShadow: 'var(--shadow-soft)',
          padding: 'var(--space-lg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        {...rest}
      >
        {/* Gradient background overlay with glass effect */}
        {gradientBg && (
          <div
            className="absolute inset-0 z-0"
            style={{
              background: gradientBg,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          />
        )}

        <div className="relative z-10 flex items-start justify-between">
          {label && (
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90 drop-shadow-sm">
              {label}
            </span>
          )}
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-1.5 text-start" dir="auto">
          <h3 className="text-lg font-bold leading-tight text-white drop-shadow-md">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs leading-snug text-white/80 line-clamp-2 drop-shadow-sm">
              {subtitle}
            </p>
          )}
        </div>

        {/* Icon in bottom-right */}
        {(icon || emoji) && (
          <div className="absolute bottom-4 right-4 z-10">
            {emoji && (
              <span className="text-2xl opacity-50 drop-shadow">{emoji}</span>
            )}
            {icon && !emoji && isFontAwesomeIcon && (
              <FontAwesomeIcon 
                icon={icon as IconDefinition} 
                className="text-2xl text-white/30 drop-shadow"
              />
            )}
            {icon && !emoji && !isFontAwesomeIcon && typeof icon === 'function' && (() => {
              const IconComponent = icon as ComponentType<IconProps>
              return <IconComponent className="h-6 w-6 opacity-30 drop-shadow" />
            })()}
          </div>
        )}
      </div>
    </Link>
  )
})

export default MenuTile
