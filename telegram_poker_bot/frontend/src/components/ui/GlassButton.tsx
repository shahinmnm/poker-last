import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export type GlassButtonVariant = 'fold' | 'check' | 'bet' | 'raise' | 'allIn'

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant
  fullWidth?: boolean
}

const baseClasses = `
  glass-button
  relative
  inline-flex
  items-center
  justify-center
  font-bold
  tracking-tight
  transition-all
  duration-150
  ease-out
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-offset-2
  focus-visible:ring-white/20
  overflow-hidden
`

const sizeClasses = `
  px-2.5
  py-1.75
  text-[13px]
  sm:text-sm
  rounded-xl
`

// Glassmorphism variant styles inspired by glass_kit
const variantMap: Record<GlassButtonVariant, string> = {
  fold: 'glass-button--fold',
  check: 'glass-button--check',
  bet: 'glass-button--bet',
  raise: 'glass-button--raise',
  allIn: 'glass-button--all-in',
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    { className, children, variant = 'check', fullWidth = false, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          sizeClasses,
          variantMap[variant],
          fullWidth && 'w-full',
          disabled && 'glass-button--disabled',
          className,
        )}
        disabled={disabled}
        {...rest}
      >
        {/* Button content */}
        <span className="glass-button__content">{children}</span>
      </button>
    )
  },
)

export default GlassButton
