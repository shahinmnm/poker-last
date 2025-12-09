import { Menu } from 'lucide-react'
import type { ConnectionState, TableMetadata } from '@/types/normalized'
import { useGameVariant } from '@/utils/gameVariant'
import { cn } from '@/utils/cn'
import ConnectionStatus from '../ui/ConnectionStatus'
import Button from '../ui/Button'

interface TableHeaderProps {
  metadata: TableMetadata
  connectionState: ConnectionState
  onMenuOpen?: () => void
}

export default function TableHeader({ metadata, connectionState, onMenuOpen }: TableHeaderProps) {
  const { icon: VariantIcon, text: colorClass } = useGameVariant(metadata.variant)

  return (
    <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto mt-[calc(env(safe-area-inset-top)+12px)] flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/80 backdrop-blur-md px-3 py-1 shadow-2xl transition-all max-w-[90vw] w-auto">
        <div className="flex items-center gap-2">
          <ConnectionStatus state={connectionState} />
        </div>

        <div className="h-8 w-px bg-white/10" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
            <VariantIcon className={cn('h-4 w-4', colorClass)} />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold text-white truncate">{metadata.name}</span>
            <span className="text-[11px] text-gray-400">{metadata.stakes}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full px-3 text-white hover:bg-white/10 focus-visible:ring-offset-0"
          onClick={onMenuOpen}
          disabled={!onMenuOpen}
          aria-label="Table menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
