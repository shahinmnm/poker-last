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
    <div className="segmented-control" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            onClick={() => onChange(tab)}
            className={cn('segmented-control__option ui-nowrap', isActive && 'is-active')}
            aria-selected={isActive}
          >
            {labels[tab]}
          </button>
        )
      })}
    </div>
  )
}
