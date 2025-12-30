import { type HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface ToggleProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ checked, onChange, disabled = false, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center transition-colors duration-150 motion-reduce:transition-none',
        'rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-main)] focus-visible:ring-offset-2',
        checked ? 'bg-[color:var(--accent-main)]' : 'bg-[rgba(148,163,184,0.5)]',
        disabled && 'cursor-not-allowed opacity-50 focus:ring-0 focus-visible:ring-0',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-md transition-transform duration-150 motion-reduce:transition-none',
          checked ? 'translate-x-[22px]' : 'translate-x-[4px]',
        )}
      />
    </button>
  )
}

export default Toggle
