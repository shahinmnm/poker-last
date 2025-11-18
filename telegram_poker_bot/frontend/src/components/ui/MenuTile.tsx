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
  badge?: string | number
  to: string
  recommended?: boolean
  quickTag?: string
  pulse?: boolean
  shine?: boolean
  depth?: boolean
  emoji?: string
  tileColor?: string
}

export const MenuTile = forwardRef<HTMLDivElement, MenuTileProps>(function MenuTile(
  { className, icon, title, subtitle, to, emoji, tileColor, ...rest },
  ref,
) {
  // Check if icon is a Font Awesome icon definition
  const isFontAwesomeIcon = icon && typeof icon === 'object' && 'iconName' in icon

  return (
    <Link to={to} className="block">
      <div
        ref={ref}
        className={cn(
          'relative isolate flex h-[128px] w-full flex-col overflow-hidden',
          'border border-[rgba(15,23,42,0.6)] text-[color:var(--text-strong)]',
          'transition-[transform,box-shadow] duration-[120ms] ease-out active:scale-95 active:shadow-none',
          className,
        )}
        style={{
          backgroundColor: tileColor || 'rgba(15,23,42,0.55)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-soft)',
          padding: 'var(--space-md)',
        }}
        {...rest}
      >
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {emoji && (
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/18 border border-white/12">
                <span className="text-base">{emoji}</span>
              </div>
            )}
            {icon && !emoji && (
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/18 border border-white/12">
                {isFontAwesomeIcon ? (
                  <FontAwesomeIcon icon={icon as IconDefinition} className="text-base" />
                ) : (
                  // Legacy custom SVG icon support
                  typeof icon === 'function' && (() => {
                    const IconComponent = icon as ComponentType<IconProps>
                    return <IconComponent className="w-4 h-4" />
                  })()
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-1 text-start" dir="auto">
          <h3
            className="font-semibold leading-tight truncate"
            style={{
              fontSize: 'var(--fs-title)',
              color: 'var(--text-strong)',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className="leading-relaxed line-clamp-2"
              style={{
                fontSize: 'var(--fs-body)',
                color: 'var(--text-muted)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
})

export default MenuTile
