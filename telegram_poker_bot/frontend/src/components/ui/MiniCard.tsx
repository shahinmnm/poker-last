import clsx from 'clsx'

type MiniCardSize = 'sm'

interface MiniCardProps {
  card: string
  size?: MiniCardSize
  className?: string
}

const rankMap: Record<string, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
}

const suitSymbols: Record<string, { symbol: string; color: 'red' | 'dark' }> = {
  h: { symbol: '♥', color: 'red' },
  d: { symbol: '♦', color: 'red' },
  s: { symbol: '♠', color: 'dark' },
  c: { symbol: '♣', color: 'dark' },
}

const sizeMap: Record<MiniCardSize, { width: number; height: number; radius: number; fontSize: number }> = {
  sm: { width: 22, height: 30, radius: 6, fontSize: 11 },
}

export default function MiniCard({ card, size = 'sm', className }: MiniCardProps) {
  const cardCode = card.trim()
  const rankKey = cardCode[0]?.toUpperCase() ?? ''
  const suitKey = cardCode[1]?.toLowerCase() ?? ''

  const rank = rankMap[rankKey] ?? (rankKey || '•')
  const suit = suitSymbols[suitKey] ?? { symbol: '', color: 'dark' }
  const dimensions = sizeMap[size]
  const isHidden = cardCode.toUpperCase() === 'XX'
  const hasValidFace = Boolean(rankKey && suit.symbol)
  const isRedSuit = suit.color === 'red'

  if (isHidden || !hasValidFace) {
    return (
      <div
        className={clsx(
          'bg-gradient-to-br from-slate-700/70 to-slate-900/70 border border-white/10 shadow-inner',
          className,
        )}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          borderRadius: `${dimensions.radius}px`,
        }}
        aria-hidden={true}
      />
    )
  }

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center bg-white/95 text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.14)] border leading-none select-none',
        isRedSuit ? 'text-[#d6223a] border-[#f3c1cb]' : 'border-slate-200/80',
        className,
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        borderRadius: `${dimensions.radius}px`,
        fontSize: `${dimensions.fontSize}px`,
        lineHeight: 1.08,
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={cardCode}
      dir="auto"
    >
      <span className="font-semibold leading-tight">{rank}</span>
      <span className="leading-tight">{suit.symbol}</span>
    </div>
  )
}
