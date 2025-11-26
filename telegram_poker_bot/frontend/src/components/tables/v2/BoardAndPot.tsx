import { forwardRef } from 'react'
import CommunityCards from '@/components/table/CommunityCards'

interface BoardAndPotProps {
  cards: string[]
  potAmount: number
  winningCards?: string[]
}

const BoardAndPot = forwardRef<HTMLDivElement, BoardAndPotProps>(function BoardAndPot({ cards, potAmount, winningCards }, ref) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={ref}
        className="rounded-full border border-amber-400/30 bg-white/5 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200 shadow-[0_10px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <span className="opacity-80">Pot</span>
        <span className="ml-2 text-[13px] text-amber-100">{potAmount}</span>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <CommunityCards cards={cards} highlightedCards={winningCards} />
      </div>
    </div>
  )
})

export default BoardAndPot
