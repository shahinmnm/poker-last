import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'muted'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variantMap: Record<BadgeVariant, string> = {
  primary: 'bg-gradient-to-r from-[color:var(--accent-start)] to-[color:var(--accent-end)] text-white',
  secondary: 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]',
  success: 'bg-emerald-500/20 text-emerald-300 dark:bg-emerald-500/30 dark:text-emerald-200',
  warning: 'bg-amber-500/20 text-amber-300 dark:bg-amber-500/30 dark:text-amber-200',
  info: 'bg-blue-500/20 text-blue-300 dark:bg-blue-500/30 dark:text-blue-200',
  muted: 'bg-white/10 text-[color:var(--text-primary)]',
}

const sizeMap: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, children, variant = 'secondary', size = 'md', ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase tracking-[0.2em]',
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
