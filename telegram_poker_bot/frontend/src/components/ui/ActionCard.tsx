import type { ComponentType, HTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '../../utils/cn'
import type { IconProps } from './icons'

export interface ActionCardProps extends HTMLAttributes<HTMLDivElement> {
  icon: ComponentType<IconProps>
  title: string
  subtitle?: string
  to: string
  accent?: 'primary' | 'secondary'
}

export function ActionCard({ className, icon: Icon, title, subtitle, to, accent = 'primary', ...rest }: ActionCardProps) {
  return (
    <Link to={to} className="block">
      <div
        className={cn(
          'group relative isolate flex h-[152px] flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] border border-white/8 bg-[rgba(6,12,24,0.9)] p-4 text-[color:var(--color-text)] shadow-[0_14px_36px_rgba(0,0,0,0.75)] transition duration-150 ease-out active:scale-95',
          className,
        )}
        {...rest}
      >
        <span
          className={cn(
            'absolute right-[-18%] top-[-22%] h-28 w-28 rounded-full blur-[46px]',
            accent === 'primary'
              ? 'bg-[radial-gradient(circle_at_center,rgba(34,242,239,0.18),transparent_55%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(252,146,63,0.2),transparent_55%)]',
          )}
          aria-hidden
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
              <Icon className={accent === 'primary' ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-accent-secondary)]'} />
            </span>
            <span className="h-2 w-2 rounded-full" style={{ background: accent === 'primary' ? 'var(--color-accent)' : 'var(--color-accent-secondary)' }} />
          </div>
        </div>
        <div className="relative z-10 mt-auto flex flex-col gap-2">
          <h3 className="text-lg font-semibold leading-tight tracking-tight">{title}</h3>
          {subtitle && <p className="text-sm text-[color:var(--color-text-muted)]">{subtitle}</p>}
        </div>
      </div>
    </Link>
  )
}

export default ActionCard
