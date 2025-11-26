import { forwardRef } from 'react'
import CommunityCards from '@/components/table/CommunityCards'

interface BoardAndPotProps {
  cards: string[]
  potAmount: number
  winningCards?: string[]
}

const BoardAndPot = forwardRef<HTMLDivElement, BoardAndPotProps>(function BoardAndPot({ cards, potAmount, winningCards }, ref) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        className="rounded-full bg-black/30 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur-lg"
      >
        <span className="opacity-80">Pot • </span>
        <span className="text-emerald-100">{potAmount}</span>
      </div>
      <div className="rounded-2xl bg-black/30 p-2 shadow-xl backdrop-blur-xl">
        <div className="scale-90 sm:scale-100">
          <CommunityCards cards={cards} highlightedCards={winningCards} />
        </div>
      </div>
    </div>
  )
})

export default BoardAndPot
