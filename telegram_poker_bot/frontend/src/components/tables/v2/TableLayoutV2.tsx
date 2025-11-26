import { ReactNode } from 'react'

interface TableLayoutV2Props {
  infoPill?: ReactNode
  board?: ReactNode
  players?: ReactNode
  hero?: ReactNode
  action?: ReactNode
  overlays?: ReactNode
}

export default function TableLayoutV2({ infoPill, board, players, hero, action, overlays }: TableLayoutV2Props) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0f2a1a]" style={{ height: 'calc(100vh - env(safe-area-inset-bottom))' }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(30,126,80,0.55) 0%, rgba(9,34,20,0.95) 55%, rgba(4,17,10,1) 100%)',
        }}
      />
      {infoPill && <div className="absolute top-3 right-3 z-40">{infoPill}</div>}
      {players}
      {board && <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">{board}</div>}
      {hero && <div className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2">{hero}</div>}
      {action && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">{action}</div>}
      {overlays}
    </div>
  )
}
