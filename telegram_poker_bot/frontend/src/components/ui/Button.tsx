import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  glow?: boolean
}

const baseClasses =
  'app-button inline-flex items-center justify-center font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

const variantMap: Record<ButtonVariant, string> = {
  primary: 'app-button--primary',
  secondary: 'app-button--secondary',
  ghost: 'app-button--ghost',
}

const sizeMap: Record<ButtonSize, string> = {
  md: 'app-button--md',
  lg: 'app-button--lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, variant = 'primary', size = 'md', block = false, glow = false, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        baseClasses,
        variantMap[variant],
        sizeMap[size],
        block && 'w-full',
        glow && variant === 'primary' && 'app-button--glow',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
