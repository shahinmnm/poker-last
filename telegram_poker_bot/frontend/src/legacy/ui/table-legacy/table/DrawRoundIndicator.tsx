interface DrawRoundIndicatorProps {
  currentRound: number
  maxRounds: number
  variant?: string
}

/**
 * DrawRoundIndicator Component
 * 
 * Displays current draw round for draw poker variants.
 * Structure only - no CSS styling.
 */
export default function DrawRoundIndicator({
  currentRound,
  maxRounds,
  variant,
}: DrawRoundIndicatorProps) {
  return (
    <div data-component="draw-round-indicator">
      <span data-label="variant">{variant || 'Draw Poker'}</span>
      <span data-label="round">
        Round {currentRound} of {maxRounds}
      </span>
      <div data-progress-container>
        {Array.from({ length: maxRounds }, (_, i) => (
          <span
            key={i}
            data-round-marker={i + 1}
            data-active={i + 1 === currentRound}
            data-completed={i + 1 < currentRound}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  )
}
