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
          'border',
          'transition-[transform,box-shadow] duration-[120ms] ease-out active:scale-[0.97]',
          className,
        )}
        style={{
          borderRadius: 'var(--radius-tile)',
          borderColor: 'var(--color-border-glass)',
          boxShadow: 'var(--shadow-tile-glow)',
          padding: 'var(--space-lg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        {...rest}
      >
        {/* Gradient background overlay with glass effect */}
        {gradientBg && (
          <>
            <div
              className="absolute inset-0 z-0"
              style={{
                background: gradientBg,
              }}
            />
            <div
              className="absolute inset-0 z-[1]"
              style={{
                background: 'var(--tile-glass)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            />
          </>
        )}

        {/* Diagonal highlight stripe for glass effect */}
        <div
          className="absolute top-0 left-[15%] right-[15%] h-[40%] z-[2] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent)',
            borderRadius: 'var(--radius-tile) var(--radius-tile) 0 0',
          }}
        />

        <div className="relative z-10 flex items-start justify-between">
          {label && (
            <span 
              className="text-xs font-semibold uppercase tracking-wider drop-shadow-sm"
              style={{ color: 'var(--color-text-inverse)' }}
            >
              {label}
            </span>
          )}
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-1.5 text-start" dir="auto">
          <h3 
            className="text-lg font-bold leading-tight drop-shadow-md"
            style={{ color: 'var(--color-text-inverse)' }}
          >
            {title}
          </h3>
          {subtitle && (
            <p 
              className="text-xs leading-snug line-clamp-2 drop-shadow-sm"
              style={{ color: 'rgba(255, 255, 255, 0.85)' }}
            >
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
                className="text-2xl drop-shadow"
                style={{ color: 'rgba(255, 255, 255, 0.35)' }}
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
