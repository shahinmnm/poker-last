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
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#050816]"
      style={{ height: 'calc(100vh - env(safe-area-inset-bottom))' }}
    >
      {/* Blue gradient + glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 80% at 50% 35%, rgba(46,118,255,0.14) 0%, rgba(11,26,60,0.9) 50%, rgba(5,8,22,0.98) 100%), linear-gradient(180deg, #050816 0%, #071225 80%)',
        }}
      />

      {/* Neon arc hint */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[70vh] w-[110vw] -translate-x-1/2 -translate-y-[48%] rounded-[999px] border border-cyan-400/10 shadow-[0_0_120px_rgba(59,130,246,0.12)]"
        style={{
          background:
            'radial-gradient(70% 60% at 50% 55%, rgba(38,92,199,0.18) 0%, rgba(6,14,31,0.8) 60%, rgba(5,8,22,0.9) 100%)',
          boxShadow: '0 0 90px rgba(64,174,255,0.18), inset 0 0 40px rgba(20,99,187,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      />

      {infoPill && <div className="absolute inset-x-4 top-4 z-40 flex justify-end sm:justify-center">{infoPill}</div>}
      {players}
      {board && (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
          {board}
        </div>
      )}
      {hero && <div className="absolute bottom-[18%] left-1/2 z-30 -translate-x-1/2">{hero}</div>}
      {action && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">{action}</div>}
      {overlays}
    </div>
  )
}
