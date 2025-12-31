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
    <div className="flex items-center gap-2 overflow-x-auto rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] p-1">
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'group inline-flex min-h-[44px] shrink-0 items-center',
            )}
          >
            <span
              className={cn(
                'flex h-8 items-center rounded-full px-3 text-[clamp(11px,1.6vw,12px)] font-semibold transition',
                isActive
                  ? 'bg-[var(--surface-1)] text-[var(--text-1)] shadow-[0_0_0_1px_var(--border-1),0_0_12px_rgba(44,197,122,0.25)]'
                  : 'text-[var(--text-3)] group-hover:text-[var(--text-1)]',
              )}
            >
              {labels[tab]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
