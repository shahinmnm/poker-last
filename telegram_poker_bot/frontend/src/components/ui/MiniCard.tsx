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
  const rankKey = card?.[0]?.toUpperCase() ?? ''
  const suitKey = card?.[1]?.toLowerCase() ?? ''

  const rank = rankMap[rankKey] ?? (rankKey || '•')
  const suit = suitSymbols[suitKey] ?? { symbol: '', color: 'dark' }
  const dimensions = sizeMap[size]

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] border leading-none select-none',
        suit.color === 'red' ? 'text-rose-600 border-rose-200' : 'border-slate-200',
        className,
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        borderRadius: `${dimensions.radius}px`,
        fontSize: `${dimensions.fontSize}px`,
        lineHeight: 1.05,
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={card}
      dir="auto"
    >
      <span className="font-semibold leading-tight">{rank}</span>
      <span className="leading-tight">{suit.symbol}</span>
    </div>
  )
}
