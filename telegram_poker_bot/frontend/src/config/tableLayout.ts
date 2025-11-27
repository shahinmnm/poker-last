export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 64 }
const TABLE_RADIUS = { x: 47.5, y: 36 }

const angleToPosition = (angleDegrees: number): SeatPosition => {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    xPercent: Math.round((TABLE_CENTER.x + TABLE_RADIUS.x * Math.cos(radians)) * 10) / 10,
    yPercent: Math.round((TABLE_CENTER.y + TABLE_RADIUS.y * Math.sin(radians)) * 10) / 10,
  }
}

export const getSeatLayout = (seatCount: number): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 1), 8)
  const step = 360 / clamped
  const startAngle = 90

  return Array.from({ length: clamped }, (_, index) => {
    const angle = startAngle + step * index
    return {
      ...angleToPosition(angle),
      isHeroPosition: index === 0,
    }
  })
}
