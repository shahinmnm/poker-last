import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'muted'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variantMap: Record<BadgeVariant, string> = {
  primary: 'bg-gradient-to-r from-[color:var(--color-accent-start)] to-[color:var(--color-accent-end)] text-white',
  secondary: 'bg-[color:var(--color-accent-soft)] text-[color:var(--color-text)]',
  success: 'bg-[color:var(--color-success-bg)] text-[color:var(--color-success-text)]',
  warning: 'bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning-text)]',
  info: 'bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)]',
  muted: 'bg-white/10 text-[color:var(--color-text)]',
}

const sizeMap: Record<BadgeSize, string> = {
  sm: 'px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-size-xs)]',
  md: 'px-[var(--space-md)] py-[var(--space-xs)] text-[var(--font-size-sm)]',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, children, variant = 'secondary', size = 'md', ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-[var(--radius-pill)] font-semibold uppercase tracking-[var(--letter-spacing-widest)]',
        variantMap[variant],
        sizeMap[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
})

export default Badge
