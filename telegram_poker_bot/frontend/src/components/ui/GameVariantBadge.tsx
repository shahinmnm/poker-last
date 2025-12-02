import { cn } from '@/utils/cn'
import { useGameVariant } from '@/utils/gameVariant'

type Size = 'sm' | 'lg'

interface Props {
  variant?: string | null
  size?: Size
  className?: string
}

const SIZE_STYLES: Record<Size, string> = {
  sm: 'text-[11px] px-2.5 py-1 rounded-xl',
  lg: 'text-sm px-3.5 py-2 rounded-2xl',
}

export function GameVariantBadge({ variant, size = 'sm', className }: Props) {
  const config = useGameVariant(variant)
  const Icon = config.icon
  const pulseClass =
    config.pulse && size === 'lg'
      ? 'animate-pulse'
      : config.pulse && size === 'sm'
        ? 'animate-[pulse_2s_ease-in-out_infinite]'
        : ''

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md',
        'bg-gradient-to-br',
        config.accentSoft,
        SIZE_STYLES[size],
        pulseClass,
        className,
      )}
      style={{ borderColor: 'var(--glass-border)' }}
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full border',
          'bg-gradient-to-br',
          config.accent,
          config.text,
        )}
        style={{
          borderColor: 'rgba(255,255,255,0.18)',
          boxShadow: '0 0 0 6px rgba(255,255,255,0.06)',
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="font-semibold tracking-wide uppercase">{config.shortName}</span>
        {size === 'lg' ? (
          <span className="text-[10px] uppercase opacity-80">{config.fullName}</span>
        ) : null}
      </div>
    </span>
  )
}

export default GameVariantBadge
