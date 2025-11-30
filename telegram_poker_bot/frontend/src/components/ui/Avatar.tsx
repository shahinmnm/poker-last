import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTelegram } from '../../hooks/useTelegram'
import { cn } from '../../utils/cn'
import { formatChips } from '../../utils/formatChips'

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  wrapperClassName?: string
  style?: CSSProperties
  name?: string | null
  seed?: string | null
  balance?: number | string | null
  isActive?: boolean
  hasFolded?: boolean
  showTurnIndicator?: boolean
  showFoldLabel?: boolean
  chipTone?: 'gold' | 'emerald' | 'blue' | 'slate'
  overlayContent?: ReactNode
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

const CHIP_THEMES = {
  gold: {
    background: 'linear-gradient(135deg, #f8d34c, #f59e0b)',
    face: '#fff7d6',
    rim: '#d97706',
    accent: '#fde68a',
    text: '#422006',
  },
  emerald: {
    background: 'linear-gradient(135deg, #34d399, #10b981)',
    face: '#d1fae5',
    rim: '#0f9f6e',
    accent: '#6ee7b7',
    text: '#064e3b',
  },
  blue: {
    background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
    face: '#dbeafe',
    rim: '#1d4ed8',
    accent: '#93c5fd',
    text: '#0b2b57',
  },
  slate: {
    background: 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
    face: '#e2e8f0',
    rim: '#64748b',
    accent: '#cbd5e1',
    text: '#0f172a',
  },
}

type ChipTone = keyof typeof CHIP_THEMES

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

function resolveChipTone(balance: AvatarProps['balance'], explicitTone?: ChipTone): ChipTone {
  if (explicitTone) return explicitTone
  const numeric = typeof balance === 'string' ? Number(balance) : balance
  if (!Number.isFinite(numeric)) return 'slate'
  if ((numeric ?? 0) >= 10000) return 'gold'
  if ((numeric ?? 0) >= 1000) return 'emerald'
  if ((numeric ?? 0) > 0) return 'blue'
  return 'slate'
}

function formatBalance(balance: AvatarProps['balance']) {
  if (balance === null || balance === undefined) return null
  if (typeof balance === 'string' && balance.trim() === '') return null

  const numeric = typeof balance === 'string' ? Number(balance) : balance
  if (Number.isFinite(numeric)) {
    const value = Number(numeric)
    const display =
      Math.abs(value) < 1000
        ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : formatChips(value)
    return `$${display}`
  }

  return String(balance)
}

export default function Avatar({
  size = 'md',
  className,
  wrapperClassName,
  style,
  name,
  seed,
  balance,
  isActive = false,
  hasFolded = false,
  showTurnIndicator = true,
  showFoldLabel = true,
  chipTone,
  overlayContent,
}: AvatarProps) {
  const { user } = useTelegram()
  const displayName = name || user?.first_name || user?.username || ''
  const avatarSeed = seed || user?.username || user?.id?.toString() || displayName || 'poker'

  const gradient = useMemo(() => buildGradient(avatarSeed), [avatarSeed])
  const initials = useMemo(() => getInitials(displayName || avatarSeed), [displayName, avatarSeed])
  const chipLabel = useMemo(() => formatBalance(balance), [balance])
  const tone = useMemo(() => resolveChipTone(balance, chipTone), [balance, chipTone])

  const ringBackground = useMemo(() => {
    if (hasFolded) {
      return 'conic-gradient(from 90deg, rgba(148,163,184,0.6), rgba(239,68,68,0.5), rgba(148,163,184,0.6))'
    }
    if (isActive && showTurnIndicator) {
      return 'conic-gradient(from 90deg, #fbbf24, #34d399, #38bdf8, #fbbf24)'
    }
    return 'conic-gradient(from 90deg, rgba(255,255,255,0.22), rgba(148,163,184,0.45), rgba(255,255,255,0.22))'
  }, [hasFolded, isActive, showTurnIndicator])

  return (
    <div className={cn('relative inline-flex flex-col items-center gap-2', wrapperClassName)}>
      <div className="relative flex items-center justify-center">
        {showTurnIndicator && (
          <span
            className={cn(
              'pointer-events-none absolute inset-[-8px] rounded-full opacity-90',
              isActive && !hasFolded ? 'animate-[spin_9s_linear_infinite]' : 'animate-none',
            )}
            style={{
              background: ringBackground,
              boxShadow: isActive
                ? '0 0 0 4px rgba(16,185,129,0.18), 0 0 18px rgba(59,130,246,0.2)'
                : '0 0 0 3px rgba(255,255,255,0.06)',
              filter: hasFolded ? 'grayscale(0.7)' : undefined,
              transform: 'translateZ(0)',
            }}
            aria-hidden
          />
        )}

        <div
          className={cn(
            'relative z-10 flex items-center justify-center overflow-hidden rounded-full border border-white/25 text-white shadow-[0_6px_18px_rgba(0,0,0,0.4)]',
            'font-black leading-[0.95] tracking-tight',
            sizeClasses[size],
            hasFolded && 'grayscale opacity-70',
            className,
          )}
          style={{ background: gradient, ...style }}
        >
          <span className="select-none" aria-hidden>
            {initials}
          </span>
        </div>

        {overlayContent && (
          <div className="pointer-events-none absolute inset-0">{overlayContent}</div>
        )}

        {hasFolded && showFoldLabel && (
          <span className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center">
            <span className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-rose-100 shadow-md">
              Fold
            </span>
          </span>
        )}
      </div>

      {chipLabel && (
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={{
            background: CHIP_THEMES[tone].background,
            color: CHIP_THEMES[tone].text,
            border: `1px solid ${CHIP_THEMES[tone].rim}`,
          }}
        >
          <span
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-full"
            style={{
              background: CHIP_THEMES[tone].face,
              boxShadow: `0 0 0 2px ${CHIP_THEMES[tone].rim}`,
              color: CHIP_THEMES[tone].text,
            }}
            aria-hidden
          >
            <span
              className="absolute inset-[3px] rounded-full border border-white/70 opacity-90"
              aria-hidden
            />
            <span
              className="absolute inset-[1px] rounded-full"
              style={{ boxShadow: `0 0 0 1px ${CHIP_THEMES[tone].accent} inset` }}
              aria-hidden
            />
            <span className="relative text-[10px] font-black">$</span>
          </span>
          <span className="tabular-nums drop-shadow-sm">{chipLabel}</span>
        </div>
      )}
    </div>
  )
}
