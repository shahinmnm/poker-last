export interface SeatPosition {
  x: number
  y: number
  angle: number
}

export function computeSeatPositions(seatCount: number, radius: number): SeatPosition[] {
  const positions: SeatPosition[] = []
  const center = radius

  for (let i = 0; i < seatCount; i += 1) {
    const angle = (2 * Math.PI * i) / seatCount - Math.PI / 2
    positions.push({
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      angle,
    })
  }

  return positions
}
