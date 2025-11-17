import { useId, useMemo } from 'react'

import { cn } from '../../utils/cn'

export interface SegmentedOption<T extends string>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: T
  label: string
  description?: string
}

export interface SegmentedControlProps<T extends string> {
  name?: string
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const instanceId = useId()
  const isRtl = useMemo(() => typeof document !== 'undefined' && document.dir === 'rtl', [])
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  )
  const segmentWidth = options.length > 0 ? 100 / options.length : 100
  const translateIndex = isRtl ? options.length - 1 - activeIndex : activeIndex

  return (
    <div className={cn('app-segmented-control', className)}>
      <span
        className="app-segmented-control__slider"
        style={{
          width: `${segmentWidth}%`,
          transform: `translateX(${translateIndex * 100}%)`,
        }}
        aria-hidden
      />
      {options.map((option) => {
        const id = `${instanceId}-${option.value}`
        const active = option.value === value
        return (
          <label key={option.value} htmlFor={id} className={cn('app-segmented-control__option', active && 'is-active')}>
            <input
              id={id}
              name={name || instanceId}
              type="radio"
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="app-segmented-control__label">{option.label}</span>
            {option.description && <span className="app-segmented-control__description">{option.description}</span>}
          </label>
        )
      })}
    </div>
  )
}

export default SegmentedControl
