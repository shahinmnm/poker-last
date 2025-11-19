import { cn } from '../../utils/cn'

export interface FilterOption {
  id: string
  label: string
}

interface FilterPillsProps {
  options: FilterOption[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function FilterPills({ options, activeId, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto', className)} style={{ scrollbarWidth: 'none' }}>
      {options.map((option) => {
        const isActive = option.id === activeId
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              'shrink-0 rounded-pill px-4 py-2 text-sm font-medium transition-all duration-200',
              'border backdrop-blur-md active:scale-95',
              isActive
                ? 'border-accent/40 bg-accent text-white shadow-md'
                : 'border-border bg-glass/50 text-text-muted hover:border-accent/30 hover:text-text hover:bg-glass/70'
            )}
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default FilterPills
