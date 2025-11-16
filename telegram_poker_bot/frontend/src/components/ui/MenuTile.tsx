import { forwardRef, type ComponentType, type HTMLAttributes, type PointerEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../../utils/cn'
import Badge from './Badge'
import type { IconProps } from './icons'

export interface MenuTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: ComponentType<IconProps>
  title: string
  subtitle?: string
  badge?: string | number
  to: string
  recommended?: boolean
  quickTag?: string
  pulse?: boolean
  shine?: boolean
  depth?: boolean
}

export const MenuTile = forwardRef<HTMLDivElement, MenuTileProps>(function MenuTile(
  { className, icon: Icon, title, subtitle, badge, to, recommended = false, quickTag, pulse, shine, depth, ...rest },
  ref,
) {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null)

  const handlePress = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setRipple({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      id: Date.now(),
    })
  }

  return (
    <Link to={to} className="block">
      <div
        ref={ref}
        onPointerDown={handlePress}
        className={cn(
          'relative isolate flex h-[172px] w-full flex-col justify-between overflow-hidden rounded-[22px]',
          'bg-[color:var(--surface-overlay)] text-[color:var(--text-primary)]',
          'border border-[color:var(--glass-border)] shadow-[0_18px_46px_rgba(0,0,0,0.32)] backdrop-blur-[18px]',
          'transition-transform duration-150 ease-out active:scale-[0.96]',
          depth && 'shadow-[0_22px_52px_rgba(0,0,0,0.4)]',
          recommended &&
            'after:absolute after:-inset-px after:-z-10 after:rounded-[24px] after:bg-[conic-gradient(at_50%_50%,var(--accent-end),rgba(44,197,122,0.12),var(--accent-soft),var(--accent-end))] after:opacity-90 after:blur-[1.2px]',
          className,
        )}
        {...rest}
      >
        <div className="pointer-events-none absolute inset-[1px] rounded-[21px] border border-[color:var(--glass-border)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_20%_15%,var(--glass-highlight),transparent_40%),radial-gradient(circle_at_80%_0%,var(--accent-soft),transparent_38%)]" aria-hidden />
        {shine && <span className="pointer-events-none absolute inset-0 -skew-x-12 bg-[linear-gradient(120deg,rgba(255,255,255,0)_10%,var(--glass-highlight)_48%,rgba(255,255,255,0)_72%)] animate-tile-shine" aria-hidden />}
        {ripple && (
          <span
            key={ripple.id}
            className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent-soft)] opacity-70 animate-menu-ripple"
            style={{ left: ripple.x, top: ripple.y }}
            aria-hidden
          />
        )}

        {quickTag && (
          <div className="absolute inset-inline-end-3 inset-block-start-3 z-20">
            <Badge
              variant="primary"
              size="sm"
              className="bg-[color:var(--accent-soft)] px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-primary)]"
            >
              {quickTag}
            </Badge>
          </div>
        )}

        <div className="relative z-10 flex items-start justify-between">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-chip)] text-[color:var(--accent-end)] backdrop-blur-xl shadow-[0_10px_28px_rgba(44,197,122,0.32)]">
            <Icon className="h-[26px] w-[26px]" />
            {pulse && (
              <span className="absolute -inset-1 rounded-full bg-[color:var(--accent-soft)] opacity-60 blur-[2px] animate-pulse-beacon" aria-hidden />
            )}
          </div>

          {badge !== undefined && (
            <div className="shrink-0">
              <Badge variant="primary" size="sm">
                {badge}
              </Badge>
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-end gap-1">
          <h3
            className={cn(
              'text-[15px] font-medium leading-tight text-[color:var(--text-primary)]',
              'truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
              recommended && 'text-[color:var(--accent-end)] drop-shadow-[0_0_10px_rgba(44,197,122,0.6)]',
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11.5px] leading-snug text-[color:var(--text-muted)]/85 line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-[color:var(--glass-border)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[color:var(--surface-overlay)]/55 via-[color:var(--surface-overlay)]/28 to-transparent" aria-hidden />
      </div>
    </Link>
  )
})

export default MenuTile
