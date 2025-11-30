import { useMemo, type CSSProperties } from 'react'
import { cn } from '@/utils/cn'
import '../../styles/neon-table.css'

type Seat = {
  id: string
  name: string
  chips: number
  isHero?: boolean
  isTurn?: boolean
  isSB?: boolean
  isBB?: boolean
  isFolded?: boolean
  showCards?: boolean
  cards?: string[]
}

type NeonPokerTableProps = {
  players: Seat[]
  potAmount: number
  communityCards: Array<string | null>
}

const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: '♠', color: '#38bdf8' },
  h: { symbol: '♥', color: '#f472b6' },
  d: { symbol: '♦', color: '#fbbf24' },
  c: { symbol: '♣', color: '#34d399' },
}

const formatChips = (value: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

function parseCard(card: string | null) {
  if (!card || card.length < 2) return null
  const rank = card[0].toUpperCase()
  const suitCode = card[1].toLowerCase()
  const suit = SUITS[suitCode]
  return suit ? { rank, suit: suit.symbol, color: suit.color } : null
}

type CardProps = {
  card?: string | null
  back?: boolean
  placeholder?: boolean
  className?: string
}

function NeonCard({ card, back, placeholder, className }: CardProps) {
  const parsed = parseCard(card || null)
  return (
    <div
      className={cn(
        'neon-card',
        back && 'back',
        placeholder && 'placeholder',
        className,
      )}
    >
      {!placeholder && !back && parsed && (
        <>
          <span className="rank" style={{ color: parsed.color }}>
            {parsed.rank}
          </span>
          <span className="suit" style={{ color: parsed.color }}>
            {parsed.suit}
          </span>
        </>
      )}
    </div>
  )
}

function SmallCard({
  card,
  back,
  className,
  style,
}: {
  card?: string | null
  back?: boolean
  className?: string
  style?: CSSProperties
}) {
  const parsed = parseCard(card || null)
  return (
    <div className={cn('neon-card-small', back && 'back', className)} style={style}>
      {!back && parsed && (
        <span className="rank" style={{ color: parsed.color }}>
          {parsed.rank}
        </span>
      )}
      {!back && parsed && (
        <span className="suit" style={{ color: parsed.color }}>
          {parsed.suit}
        </span>
      )}
    </div>
  )
}

function SeatNode({ seat, index, total }: { seat: Seat; index: number; total: number }) {
  const seatSlots = Math.max(total, 8) // keep ~45° spacing even with fewer players
  const angleStep = 360 / seatSlots
  const startAngle = 90
  const angle = startAngle + index * angleStep
  const radiusX = 42
  const radiusY = 36
  const x = 50 + radiusX * Math.cos((angle * Math.PI) / 180)
  const y = 50 + radiusY * Math.sin((angle * Math.PI) / 180)

  const cards = seat.cards?.slice(0, 2) ?? []
  const showFront = seat.showCards || seat.isHero

  return (
    <div
      className={cn('neon-seat', seat.isFolded && 'is-folded')}
      style={{ left: `${x}%`, top: `${y}%`, zIndex: seat.isHero ? 5 : 4 }}
    >
      <div className="neon-avatar-wrap">
        <span className={cn('neon-avatar-ring', seat.isTurn && 'is-turn')} aria-hidden />
        <div className={cn('neon-avatar', seat.isFolded && 'is-folded')}>
          <span>{seat.name.slice(0, 2).toUpperCase()}</span>
        </div>
        {cards.length > 0 && (
          <div className={cn('neon-seat-cards', seat.isHero && 'hero')}>
            <SmallCard
              card={cards[0]}
              back={!showFront}
              className="shadow-lg"
              style={{
                transform: 'rotate(-6deg)',
                marginRight: '-40%',
              }}
            />
            <SmallCard
              card={cards[1]}
              back={!showFront}
              style={{ transform: 'rotate(6deg)' }}
            />
          </div>
        )}
      </div>

      <div className="neon-seat-meta">
        <div className="neon-seat-name">{seat.name}</div>
        <div className="neon-seat-chips">
          <span>${formatChips(seat.chips)}</span>
        </div>
        {(seat.isSB || seat.isBB) && (
          <div className="blind-tag-container">
            {seat.isSB && <span className="blind-tag">SB</span>}
            {seat.isBB && <span className="blind-tag bb">BB</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function NeonPokerTable({ players, potAmount, communityCards }: NeonPokerTableProps) {
  const normalizedCommunity = useMemo(() => {
    const arr = [...communityCards]
    while (arr.length < 5) arr.push(null)
    return arr.slice(0, 5)
  }, [communityCards])

  return (
    <div className="neon-table-shell">
      <div className="neon-table-ring" aria-hidden />

      <div className="neon-table-pot">
        <span className="neon-pot-label">Pot</span>
        <span className="neon-pot-amount">${formatChips(potAmount)}</span>
      </div>

      <div className="neon-community-row">
        {normalizedCommunity.map((card, idx) => (
          <NeonCard
            key={`community-${idx}`}
            card={card || undefined}
            placeholder={!card}
          />
        ))}
      </div>

      {players.map((seat, idx) => (
        <SeatNode key={seat.id} seat={seat} index={idx} total={players.length} />
      ))}
    </div>
  )
}
