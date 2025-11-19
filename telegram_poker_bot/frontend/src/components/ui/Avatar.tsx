import { useMemo, CSSProperties } from 'react'
import { useTelegram } from '../../hooks/useTelegram'
import { cn } from '../../utils/cn'

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  style?: CSSProperties
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-10 w-10 text-[1.25rem]',
  md: 'h-12 w-12 text-[1.5rem]',
  lg: 'h-16 w-16 text-[2rem]',
  xl: 'h-24 w-24 text-[2.75rem]',
}

const gradientPalette = [
  ['#3cd6a0', '#1b8961', '#0b3c49'],
  ['#ff8a5c', '#d3504a', '#7c2a70'],
  ['#7a5bff', '#4434c9', '#1d1151'],
  ['#4ac0ff', '#1b82f1', '#0c3b70'],
  ['#f7c948', '#f38b2d', '#bf2230'],
  ['#24e0a4', '#1db57c', '#0c6c56'],
  ['#f472b6', '#c084fc', '#6b21a8'],
  ['#f97316', '#ea580c', '#a855f7'],
]

function stringHash(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function buildGradient(seed: string) {
  const hash = stringHash(seed || 'poker')
  const colors = gradientPalette[hash % gradientPalette.length]
  const angle = 120 + (hash % 120)
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`
}

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'PL'
  return trimmed.slice(0, 2).toUpperCase()
}

export default function Avatar({ size = 'md', className, style }: AvatarProps) {
  const { user } = useTelegram()
  const displayName = user?.first_name || user?.username || ''
  const avatarSeed = user?.username || user?.id?.toString() || displayName || 'poker'

  const gradient = useMemo(() => buildGradient(avatarSeed), [avatarSeed])
  const initials = useMemo(() => getInitials(displayName || avatarSeed), [displayName, avatarSeed])

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-full border border-white/25 text-white shadow-[0_6px_18px_rgba(0,0,0,0.4)]',
        'font-black leading-[0.95] tracking-tight',
        sizeClasses[size],
        className
      )}
      style={{ background: gradient, ...style }}
    >
      <span className="select-none" aria-hidden>
        {initials}
      </span>
    </div>
  )
}
