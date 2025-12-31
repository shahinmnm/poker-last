import type { Card, CardCode } from '../../types/normalized'

const suitSymbolMap: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

function normalizeCardCode(card: Card | CardCode): string {
  if (!card) return '??'
  if (typeof card === 'string') return card
  if (card.hidden) return 'XX'
  if (!card.rank || !card.suit) return '??'
  return `${card.rank}${card.suit}`
}

interface MiniCardProps {
  card: Card | CardCode
  size?: 'sm' | 'md'
  className?: string
}

const sizeMap = {
  sm: {
    width: 'w-[22px]',
    height: 'h-[30px]',
    font: 'text-[11px]',
  },
  md: {
    width: 'w-[24px]',
    height: 'h-[32px]',
    font: 'text-[12px]',
  },
}

function MiniCard({ card, size = 'md', className = '' }: MiniCardProps) {
  const { width, height, font } = sizeMap[size]

  const cardCode = normalizeCardCode(card)

  const rank = cardCode?.[0] ?? '?'
  const suit = cardCode?.[1] ?? '?'

  const isHidden = cardCode === 'XX' || cardCode === 'xx'
  const isUnknown = cardCode === '??'
  const suitLower = suit?.toLowerCase()
  const suitSymbol = suitSymbolMap[suitLower ?? ''] || '?'

  const isRed = ['h', 'd'].includes(suitLower || '')
  const suitColor = isHidden || isUnknown ? 'text-gray-300' : isRed ? 'text-red-500' : 'text-gray-50'

  if (isHidden || isUnknown) {
    return (
      <div
        className={`${width} ${height} rounded-lg bg-gradient-to-br from-slate-700/70 to-slate-900/70 border border-white/10 shadow-inner ${className}`}
        aria-hidden={true}
      />
    )
  }

  return (
    <div
      className={`${width} ${height} rounded-lg bg-white/95 border border-gray-200/70 shadow-md flex flex-col items-center justify-center ${className}`}
      data-card={cardCode}
    >
      <div className={`leading-none font-semibold ${font} ${suitColor}`}>{rank}</div>
      <div className={`leading-none ${font} ${suitColor}`}>{suitSymbol}</div>
    </div>
  )
}

export default MiniCard
