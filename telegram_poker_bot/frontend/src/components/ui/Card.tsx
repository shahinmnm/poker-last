import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

export type CardVariant = 'surface' | 'overlay'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'sm' | 'md' | 'lg'
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4 sm:p-5',
  md: 'p-6 sm:p-7',
  lg: 'p-7 sm:p-8',
}

const variantMap: Record<CardVariant, string> = {
  surface: 'app-card',
  overlay: 'app-card app-card--overlay',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, variant = 'surface', padding = 'md', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(variantMap[variant], paddingMap[padding], className)}
      {...rest}
    >
      {children}
    </div>
  )
})

export default Card
