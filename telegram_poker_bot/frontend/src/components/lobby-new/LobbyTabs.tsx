import { cn } from '../../utils/cn'

export type LobbyTabKey = 'cash' | 'headsUp' | 'private' | 'history'

interface LobbyTabsProps {
  activeTab: LobbyTabKey
  onChange: (value: LobbyTabKey) => void
  labels: Record<LobbyTabKey, string>
}

export default function LobbyTabs({ activeTab, onChange, labels }: LobbyTabsProps) {
  const tabs: LobbyTabKey[] = ['cash', 'headsUp', 'private', 'history']

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] p-1">
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'min-h-[44px] flex-1 rounded-full px-3 text-xs font-semibold tracking-wide transition',
              isActive
                ? 'bg-[var(--surface-1)] text-[var(--text-1)] shadow-sm'
                : 'text-[var(--text-3)] hover:text-[var(--text-2)]',
            )}
          >
            {labels[tab]}
          </button>
        )
      })}
    </div>
  )
}
