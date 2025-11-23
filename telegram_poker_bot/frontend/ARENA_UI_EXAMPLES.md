# Arena UI Components - Quick Start Examples

## ActionDock - Quick Examples

### Basic Usage
```tsx
import ActionDock from './components/tables/ActionDock'

// Minimal example
<ActionDock
  isHandActive={true}
  availableActions={['fold', 'call', 'raise']}
  onActionSelect={(action) => console.log(action)}
/>
```

### With All Options
```tsx
<ActionDock
  isHandActive={isHandActive}
  availableActions={['fold', 'call', 'raise', 'allin']}
  onActionSelect={handleAction}
  callAmount={200}
  disabled={!isPlayerTurn}
/>
```

### State Management Example
```tsx
function PokerTable() {
  const [isHandActive, setIsHandActive] = useState(false)
  const [playerAction, setPlayerAction] = useState<string | null>(null)

  // Listen to backend events
  useEffect(() => {
    socket.on('hand_started', () => setIsHandActive(true))
    socket.on('hand_ended', () => setIsHandActive(false))
    
    return () => {
      socket.off('hand_started')
      socket.off('hand_ended')
    }
  }, [socket])

  const handleActionSelect = async (action: string) => {
    setPlayerAction(action)
    
    // Send to backend
    await api.post('/table/action', { action })
    
    // Dock will hide when isHandActive becomes false
  }

  return (
    <ActionDock
      isHandActive={isHandActive}
      availableActions={getAvailableActions()}
      onActionSelect={handleActionSelect}
      callAmount={currentBet}
      disabled={!isMyTurn}
    />
  )
}
```

---

## PlayerAvatarHUD - Quick Examples

### Basic Usage
```tsx
import PlayerAvatarHUD from './components/tables/PlayerAvatarHUD'

const player = {
  id: '1',
  username: 'Alice',
  initials: 'AL',
  chips: 5000,
  status: 'ACTIVE',
  isDealer: false,
  isCurrentTurn: false,
}

<PlayerAvatarHUD player={player} />
```

### With Turn Indicator
```tsx
const activePlayer = {
  id: '2',
  username: 'Bob',
  initials: 'BB',
  chips: 3500,
  lastAction: 'Raised 200',
  status: 'ACTIVE',
  isDealer: false,
  isCurrentTurn: true,
  turnProgress: 0.6, // 60% time remaining
}

<PlayerAvatarHUD 
  player={activePlayer} 
  positionHint="top" 
/>
```

### Dealer with Winner Badge
```tsx
const winnerPlayer = {
  id: '3',
  username: 'Charlie',
  initials: 'CH',
  avatarUrl: 'https://example.com/avatar.jpg',
  chips: 12500,
  lastAction: 'Won 1500',
  status: 'ACTIVE',
  isDealer: true,
  isCurrentTurn: false,
  isWinner: true,
}

<PlayerAvatarHUD 
  player={winnerPlayer} 
  positionHint="bottom" 
/>
```

### Multiple Players Around Table
```tsx
function PokerTable() {
  const players = [
    { id: '1', username: 'Alice', initials: 'AL', chips: 5000, status: 'ACTIVE', isDealer: true, isCurrentTurn: false },
    { id: '2', username: 'Bob', initials: 'BB', chips: 3500, status: 'ACTIVE', isDealer: false, isCurrentTurn: true, turnProgress: 0.7 },
    { id: '3', username: 'Charlie', initials: 'CH', chips: 2000, status: 'FOLDED', isDealer: false, isCurrentTurn: false },
    { id: '4', username: 'Diana', initials: 'DI', chips: 8500, status: 'ACTIVE', isDealer: false, isCurrentTurn: false },
    { id: '5', username: 'Eve', initials: 'EV', chips: 1500, status: 'ALL_IN', isDealer: false, isCurrentTurn: false },
  ]

  return (
    <div className="fixed inset-0">
      {/* Top positions */}
      <div className="absolute top-1/4 left-1/4">
        <PlayerAvatarHUD player={players[0]} positionHint="bottom" />
      </div>
      <div className="absolute top-1/4 right-1/4">
        <PlayerAvatarHUD player={players[1]} positionHint="bottom" />
      </div>

      {/* Side positions */}
      <div className="absolute top-1/2 left-12 -translate-y-1/2">
        <PlayerAvatarHUD player={players[2]} positionHint="right" />
      </div>
      <div className="absolute top-1/2 right-12 -translate-y-1/2">
        <PlayerAvatarHUD player={players[3]} positionHint="left" />
      </div>

      {/* Bottom position */}
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2">
        <PlayerAvatarHUD player={players[4]} positionHint="top" />
      </div>
    </div>
  )
}
```

---

## Complete Integration Example

### Full Table Component with Both Components

```tsx
import { useState, useEffect } from 'react'
import ActionDock from './components/tables/ActionDock'
import PlayerAvatarHUD, { type Player } from './components/tables/PlayerAvatarHUD'
import PokerFeltBackground from './components/background/PokerFeltBackground'

interface TableState {
  hand_active: boolean
  current_player_id: string
  players: Array<{
    user_id: string
    username: string
    stack: number
    in_hand: boolean
    is_button: boolean
    last_action?: string
    turn_deadline?: string
  }>
  current_bet: number
}

function PokerTable() {
  const [tableState, setTableState] = useState<TableState | null>(null)
  const myUserId = '123' // Get from auth context

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/table/1')
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setTableState(data)
    }

    return () => ws.close()
  }, [])

  if (!tableState) return <div>Loading...</div>

  // Convert backend player data to HUD format
  const hudPlayers: Player[] = tableState.players.map((p) => ({
    id: p.user_id,
    username: p.username,
    initials: p.username.slice(0, 2).toUpperCase(),
    chips: p.stack,
    lastAction: p.last_action,
    status: p.in_hand ? 'ACTIVE' : 'FOLDED',
    isDealer: p.is_button,
    isCurrentTurn: p.user_id === tableState.current_player_id,
    turnProgress: p.turn_deadline 
      ? calculateProgress(p.turn_deadline)
      : 0,
  }))

  // Determine available actions based on game state
  const getAvailableActions = () => {
    const actions: Array<'fold' | 'call' | 'check' | 'raise' | 'allin'> = []
    
    if (tableState.current_bet > 0) {
      actions.push('fold', 'call', 'raise', 'allin')
    } else {
      actions.push('fold', 'check', 'raise', 'allin')
    }
    
    return actions
  }

  const handleAction = async (action: string) => {
    try {
      await fetch('/api/table/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    } catch (error) {
      console.error('Action failed:', error)
    }
  }

  const isMyTurn = tableState.current_player_id === myUserId

  return (
    <PokerFeltBackground>
      <div className="relative w-full h-full">
        {/* Player avatars */}
        {hudPlayers.map((player, index) => {
          const position = calculatePosition(index, hudPlayers.length)
          const hint = getPositionHint(position)
          
          return (
            <div
              key={player.id}
              className="absolute"
              style={position}
            >
              <PlayerAvatarHUD player={player} positionHint={hint} />
            </div>
          )
        })}

        {/* Community cards area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Community cards component */}
        </div>

        {/* Action dock */}
        <ActionDock
          isHandActive={tableState.hand_active}
          availableActions={getAvailableActions()}
          onActionSelect={handleAction}
          callAmount={tableState.current_bet}
          disabled={!isMyTurn}
        />
      </div>
    </PokerFeltBackground>
  )
}

// Helper functions
function calculateProgress(deadline: string): number {
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const duration = 25000 // 25 seconds
  const remaining = Math.max(0, end - now)
  return Math.min(1, remaining / duration)
}

function calculatePosition(index: number, total: number) {
  // Circle layout around center
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  const radius = 200 // pixels from center
  
  return {
    left: `calc(50% + ${Math.cos(angle) * radius}px)`,
    top: `calc(50% + ${Math.sin(angle) * radius}px)`,
    transform: 'translate(-50%, -50%)',
  }
}

function getPositionHint(position: { top: string }): 'top' | 'bottom' | 'left' | 'right' {
  // Determine based on position.top value
  if (position.top.includes('20%') || position.top.includes('30%')) return 'bottom'
  if (position.top.includes('70%') || position.top.includes('80%')) return 'top'
  return 'right' // default
}

export default PokerTable
```

---

## Customization Examples

### Custom Action Colors

```tsx
// Modify ActionDock button styles
const customActionStyles = {
  fold: 'bg-red-500/80 hover:bg-red-600/80',
  call: 'bg-blue-500/80 hover:bg-blue-600/80',
  raise: 'bg-purple-500/80 hover:bg-purple-600/80',
  allin: 'bg-amber-500/80 hover:bg-amber-600/80',
}
```

### Custom Avatar Sizes

```tsx
// Adjust avatar size in PlayerAvatarHUD
const avatarSize = 64 // Instead of default 52
```

### Custom Animations

```tsx
// Modify animation durations
const customTransition = {
  duration: 0.5, // Slower animation
  ease: 'easeInOut',
}
```

---

## Troubleshooting

### Action Dock Not Showing
- Check `isHandActive` is true
- Verify `availableActions` array is not empty
- Ensure z-index is high enough (default is 50)

### Player Panel Not Opening
- Check if `useClickOutside` hook is properly imported
- Verify player data has all required fields
- Check for JavaScript errors in console

### Animations Not Smooth
- Ensure Framer Motion is installed: `npm install framer-motion`
- Check browser supports CSS transforms
- Verify no conflicting CSS transitions

### Timer Ring Not Updating
- Ensure `turnProgress` is between 0 and 1
- Check if `isCurrentTurn` is true
- Verify component re-renders when progress changes

---

## Testing Checklist

- [ ] ActionDock appears when hand starts
- [ ] ActionDock hides when hand ends
- [ ] Ghost pulse appears after dock hides
- [ ] Buttons animate in sequentially
- [ ] Click on action button triggers callback
- [ ] Avatar shows correct initials
- [ ] Timer ring updates smoothly
- [ ] Click avatar opens info panel
- [ ] Click outside closes info panel
- [ ] Panel positions correctly based on hint
- [ ] Dealer badge shows when isDealer=true
- [ ] Winner badge shows when isWinner=true
- [ ] Folded overlay appears when status=FOLDED
- [ ] Turn pulse animates when isCurrentTurn=true
- [ ] All components responsive on mobile

---

## API Reference

See [ARENA_UI_COMPONENTS.md](./ARENA_UI_COMPONENTS.md) for complete API documentation.
