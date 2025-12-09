import { Menu } from 'lucide-react'
import { useGameVariant } from '@/utils/gameVariant'
import { cn } from '@/utils/cn'
import { ConnectionStatus } from '../ui/ConnectionStatus'
import type { TableMetadata, ConnectionState } from '../../types/normalized'

interface TableHeaderProps {
  metadata: TableMetadata
  connectionState: ConnectionState
  onMenuOpen?: () => void
}

export const TableHeader = ({ metadata, connectionState, onMenuOpen }: TableHeaderProps) => {
  const { icon: VariantIcon, text: iconColorClass } = useGameVariant(metadata.variant)

  return (
    <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
      <div className="pointer-events-auto mx-auto mt-[calc(env(safe-area-inset-top)+12px)] flex items-center justify-between gap-3 
                      rounded-full border border-white/10 bg-black/80 backdrop-blur-md 
                      pl-3 pr-2 py-1 shadow-2xl transition-all duration-300 max-w-[90vw] w-auto">
        
        {/* Connection */}
        <div className="flex-shrink-0">
          <ConnectionStatus state={connectionState} />
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-white/10"></div>

        {/* Game Info with Icon */}
        <div className="flex items-center gap-2 min-w-0 px-1">
          <div className={cn('p-1 rounded-full bg-white/5', iconColorClass)}>
            <VariantIcon className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col justify-center text-left">
            <h1 className="text-[11px] font-bold text-gray-100 leading-none truncate max-w-[120px]">
              {metadata.name}
            </h1>
            <div className="text-[9px] font-medium text-gray-400 leading-none mt-1 truncate">
              {metadata.stakes}
            </div>
          </div>
        </div>

        {/* Menu Button */}
        <div className="flex-shrink-0 border-l border-white/10 pl-2">
          <button 
            onClick={onMenuOpen}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
