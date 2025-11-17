import type { HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  subtle?: boolean
}

export function GlassCard({ className, children, glow, subtle, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-[var(--shadow-card)] backdrop-blur-[18px]',
        subtle && 'border-[color:var(--color-border-subtle)] shadow-[0_14px_40px_rgba(0,0,0,0.6)]',
        className,
      )}
      {...rest}
    >
      {glow && (
        <span
          className="pointer-events-none absolute inset-x-[-30%] bottom-[-35%] h-2/3 bg-[radial-gradient(circle_at_center,rgba(34,242,239,0.2),transparent_60%)] blur-3xl"
          aria-hidden
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default GlassCard
