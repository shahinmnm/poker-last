import { forwardRef, type ComponentType, type HTMLAttributes, useMemo } from 'react'
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

  // Map gradientBg to tint and glow colors
  const { tintVar, spotlightVar, glowVar } = useMemo(() => {
    if (!gradientBg) return { tintVar: null, spotlightVar: null, glowVar: null }
    
    if (gradientBg.includes('violet-pink')) {
      return {
        tintVar: 'var(--tile-tint-violet-pink)',
        spotlightVar: 'var(--tile-spotlight-violet-pink)',
        glowVar: 'var(--tile-glow-violet-pink)',
      }
    } else if (gradientBg.includes('pink-orange')) {
      return {
        tintVar: 'var(--tile-tint-pink-orange)',
        spotlightVar: 'var(--tile-spotlight-pink-orange)',
        glowVar: 'var(--tile-glow-pink-orange)',
      }
    } else if (gradientBg.includes('gold-orange')) {
      return {
        tintVar: 'var(--tile-tint-gold-orange)',
        spotlightVar: 'var(--tile-spotlight-gold-orange)',
        glowVar: 'var(--tile-glow-gold-orange)',
      }
    } else if (gradientBg.includes('blue-violet')) {
      return {
        tintVar: 'var(--tile-tint-blue-violet)',
        spotlightVar: 'var(--tile-spotlight-blue-violet)',
        glowVar: 'var(--tile-glow-blue-violet)',
      }
    }
    
    return { tintVar: null, spotlightVar: null, glowVar: null }
  }, [gradientBg])

  return (
    <Link to={to} className="block group">
      <div
        ref={ref}
        className={cn(
          'relative isolate flex h-[140px] w-full flex-col justify-between overflow-hidden',
          'border',
          'transition-[transform,box-shadow] duration-[140ms] ease-out',
          'active:scale-[0.97]',
          className,
        )}
        style={{
          borderRadius: 'var(--radius-tile)',
          borderColor: 'var(--tile-glass-border)',
          boxShadow: 'var(--shadow-tile-glow)',
          padding: '18px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'var(--tile-glass-bg)',
        }}
        {...rest}
      >
        {/* Color tint layer */}
        {tintVar && (
          <div
            className="absolute inset-0 z-0 rounded-[inherit]"
            style={{
              background: tintVar,
            }}
          />
        )}

        {/* Spotlight blob for depth */}
        {spotlightVar && (
          <div
            className="absolute inset-0 z-[1] pointer-events-none rounded-[inherit]"
            style={{
              background: spotlightVar,
            }}
          />
        )}

        {/* Glass highlight sheen */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none rounded-[inherit]"
          style={{
            background: 'var(--tile-glass-highlight)',
          }}
        />

        {/* Hover glow effect */}
        {glowVar && (
          <div
            className="absolute inset-[-2px] z-[-1] opacity-0 transition-opacity duration-[140ms] ease-out group-hover:opacity-100 group-active:opacity-100 rounded-[inherit] blur-[16px] pointer-events-none"
            style={{
              background: glowVar,
            }}
          />
        )}

        {/* Top section: Label */}
        <div className="relative z-10">
          {label && (
            <span 
              className="text-xs font-semibold uppercase tracking-[0.06em]"
              style={{ 
                color: 'var(--color-text)',
                opacity: 0.6,
              }}
            >
              {label}
            </span>
          )}
        </div>

        {/* Bottom section: Title, Subtitle, and Icon */}
        <div className="relative z-10 flex items-end justify-between gap-3">
          {/* Text content */}
          <div className="flex flex-col gap-1 text-start min-w-0 flex-1" dir="auto">
            <h3 
              className="text-lg font-bold leading-tight"
              style={{ color: 'var(--color-text)' }}
            >
              {title}
            </h3>
            {subtitle && (
              <p 
                className="text-xs leading-snug"
                style={{ 
                  color: 'var(--color-text-muted)',
                  opacity: 0.8,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Icon in bottom-right */}
          {(icon || emoji) && (
            <div className="flex-shrink-0">
              {emoji && (
                <span className="text-2xl opacity-40">{emoji}</span>
              )}
              {icon && !emoji && isFontAwesomeIcon && (
                <FontAwesomeIcon 
                  icon={icon as IconDefinition} 
                  className="text-2xl"
                  style={{ 
                    color: 'var(--color-text)',
                    opacity: 0.35,
                  }}
                />
              )}
              {icon && !emoji && !isFontAwesomeIcon && typeof icon === 'function' && (() => {
                const IconComponent = icon as ComponentType<IconProps>
                return <IconComponent className="h-6 w-6 opacity-30" />
              })()}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
})

export default MenuTile
