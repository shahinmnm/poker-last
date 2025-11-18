import { forwardRef, type ComponentType, type HTMLAttributes, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { cn } from '../../utils/cn'
import type { IconProps } from './icons'

type AccentKey = 'violet-pink' | 'pink-orange' | 'gold-orange' | 'blue-violet'

export interface MenuTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ComponentType<IconProps> | IconDefinition
  title: string
  subtitle?: string
  label?: string
  to: string
  emoji?: string
  gradientBg?: string
  accentKey?: AccentKey
}

const ACCENT_MAP: Record<AccentKey, { tint: string; spotlight: string; glow: string; icon: string }> = {
  'violet-pink': {
    tint: 'var(--tile-tint-violet-pink)',
    spotlight: 'var(--tile-spotlight-violet-pink)',
    glow: 'var(--tile-glow-violet-pink)',
    icon: 'rgba(255, 255, 255, 0.82)',
  },
  'pink-orange': {
    tint: 'var(--tile-tint-pink-orange)',
    spotlight: 'var(--tile-spotlight-pink-orange)',
    glow: 'var(--tile-glow-pink-orange)',
    icon: 'rgba(255, 255, 255, 0.82)',
  },
  'gold-orange': {
    tint: 'var(--tile-tint-gold-orange)',
    spotlight: 'var(--tile-spotlight-gold-orange)',
    glow: 'var(--tile-glow-gold-orange)',
    icon: 'rgba(255, 255, 255, 0.82)',
  },
  'blue-violet': {
    tint: 'var(--tile-tint-blue-violet)',
    spotlight: 'var(--tile-spotlight-blue-violet)',
    glow: 'var(--tile-glow-blue-violet)',
    icon: 'rgba(255, 255, 255, 0.82)',
  },
}

function resolveAccent(accentKey?: AccentKey, gradientBg?: string) {
  if (accentKey && ACCENT_MAP[accentKey]) return ACCENT_MAP[accentKey]

  const gradient = gradientBg ?? ''
  if (gradient.includes('violet-pink')) return ACCENT_MAP['violet-pink']
  if (gradient.includes('pink-orange')) return ACCENT_MAP['pink-orange']
  if (gradient.includes('gold-orange')) return ACCENT_MAP['gold-orange']
  if (gradient.includes('blue-violet')) return ACCENT_MAP['blue-violet']

  return null
}

export const MenuTile = forwardRef<HTMLDivElement, MenuTileProps>(function MenuTile(
  { className, icon, title, subtitle, label, to, emoji, gradientBg, accentKey, ...rest },
  ref,
) {
  const accent = useMemo(() => resolveAccent(accentKey, gradientBg), [accentKey, gradientBg])
  const isFontAwesomeIcon = icon && typeof icon === 'object' && 'iconName' in icon

  return (
    <Link to={to} className="group block">
      <div
        ref={ref}
        className={cn(
          'relative isolate flex h-[140px] w-full flex-col justify-between overflow-hidden',
          'border transition-[transform,box-shadow] duration-[150ms] ease-out',
          'active:scale-[0.97]',
          className,
        )}
        style={{
          borderRadius: 'var(--radius-tile)',
          borderColor: 'var(--tile-glass-border)',
          background: 'var(--tile-glass-bg)',
          padding: '18px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: accent ? `0 12px 32px ${accent.glow}` : 'var(--shadow-tile-glow)',
        }}
        {...rest}
      >
        {accent && (
          <div
            className="absolute inset-0 z-0 rounded-[inherit]"
            style={{ background: accent.tint }}
            aria-hidden
          />
        )}

        {accent && (
          <div
            className="absolute inset-0 z-[1] rounded-[inherit]"
            style={{ background: accent.spotlight }}
            aria-hidden
          />
        )}

        <div
          className="absolute inset-0 z-[2] rounded-[inherit]"
          style={{ background: 'var(--tile-glass-highlight)' }}
          aria-hidden
        />

        {accent && (
          <div
            className="absolute inset-[-10%] z-[-1] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-60 group-active:opacity-100 rounded-[inherit] blur-[22px]"
            style={{ background: accent.glow }}
            aria-hidden
          />
        )}

        <div className="relative z-10 flex flex-col gap-3 text-left" dir="auto">
          {label && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-text-muted)] opacity-80">
              {label}
            </span>
          )}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg font-bold leading-tight text-[color:var(--color-text)]">{title}</h3>
            {subtitle && (
              <p className="text-xs leading-snug text-[color:var(--color-text-muted)] opacity-90 line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>

        {(icon || emoji) && (
          <div className="absolute bottom-4 right-4 z-10 flex items-center justify-center text-2xl">
            {emoji && <span className="opacity-70">{emoji}</span>}
            {icon && !emoji && isFontAwesomeIcon && (
              <FontAwesomeIcon
                icon={icon as IconDefinition}
                className="transition-opacity duration-150 ease-out"
                style={{ color: accent?.icon ?? 'var(--color-text)', opacity: 0.55 }}
              />
            )}
            {icon && !emoji && !isFontAwesomeIcon && typeof icon === 'function' && (() => {
              const IconComponent = icon as ComponentType<IconProps>
              return (
                <IconComponent
                  className="h-[24px] w-[24px] transition-opacity duration-150 ease-out"
                  style={{ color: accent?.icon ?? 'var(--color-text)', opacity: 0.65 }}
                />
              )
            })()}
          </div>
        )}
      </div>
    </Link>
  )
})

export default MenuTile
