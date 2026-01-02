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
    <div className="lobby-tabs lobby-panel">
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn('lobby-tabs__button ui-pill', isActive && 'is-active')}
            aria-pressed={isActive}
          >
            <span
              className={cn(
                'lobby-tabs__chip',
                isActive ? 'is-active' : 'is-inactive',
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
