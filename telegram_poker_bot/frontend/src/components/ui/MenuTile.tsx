import { forwardRef, type ComponentType, type HTMLAttributes } from 'react'
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
  return (
    <Link to={to} className="block">
      <div
        ref={ref}
        className={cn(
          'relative isolate flex h-[128px] w-full flex-col overflow-hidden rounded-[22px]',
          'bg-[rgba(15,23,42,0.55)] text-[color:var(--color-text)]',
          'border border-[color:var(--color-border-glass)] shadow-[0_12px_28px_rgba(0,0,0,0.4)] backdrop-blur-[18px]',
          'transition-[transform,box-shadow] duration-150 ease-out active:scale-95 active:shadow-[0_0_18px_rgba(44,197,122,0.55)]',
          depth && 'shadow-[0_22px_52px_rgba(0,0,0,0.45)]',
          recommended &&
            'after:absolute after:inset-px after:-z-10 after:rounded-[22px] after:bg-[conic-gradient(at_50%_50%,rgba(44,197,122,0.35),rgba(44,197,122,0.08),transparent,rgba(44,197,122,0.35))] after:blur-[1px]',
          className,
        )}
        {...rest}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_50%_120%,rgba(44,197,122,0.22),transparent_70%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_18%_12%,var(--color-glass-highlight),transparent_35%)]" aria-hidden />
        {shine && <span className="pointer-events-none absolute inset-0 -skew-x-12 bg-[linear-gradient(120deg,rgba(255,255,255,0)_10%,var(--color-glass-highlight)_48%,rgba(255,255,255,0)_72%)] animate-tile-shine" aria-hidden />}

        <div className="relative z-10 flex items-start justify-between px-3 pt-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[rgba(255,255,255,0.08)] text-[color:var(--color-text)] shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="glass-icon-circle h-[42px] w-[42px] border border-white/30 bg-white/10 text-[color:var(--color-text)]">
              <Icon className="h-[24px] w-[24px]" />
            </div>
            {pulse && (
              <span className="absolute inset-0 rounded-[16px] bg-[color:var(--color-accent-soft)] opacity-60 blur-[2px] animate-pulse-beacon" aria-hidden />
            )}
          </div>

          {(quickTag || badge !== undefined) && (
            <div className="shrink-0">
              <Badge
                variant="primary"
                size="sm"
                className="glass-pill border border-white/30 bg-[rgba(44,197,122,0.18)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
              >
                {quickTag ?? badge}
              </Badge>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-1 px-3 pb-3 text-start" dir="auto">
          <h3
            className={cn(
              'text-[15px] font-semibold leading-tight text-[color:var(--color-text)]',
              'truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
              recommended && 'text-[color:var(--color-accent-end)] drop-shadow-[0_0_10px_rgba(44,197,122,0.6)]',
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] leading-snug text-[color:var(--color-text-muted)] line-clamp-2">{subtitle}</p>
          )}
        </div>
      </div>
    </Link>
  )
})

export default MenuTile
