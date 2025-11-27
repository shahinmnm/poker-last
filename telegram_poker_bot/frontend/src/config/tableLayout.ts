export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 52 }
const TABLE_RADIUS = { x: 40, y: 30 }

const angleSets: Record<number, number[]> = {
  2: [90, 270],
  3: [90, 210, 330],
  4: [90, 210, 270, 330],
  5: [90, 150, 210, 330, 30],
  6: [90, 130, 200, 270, 340, 40],
  7: [90, 130, 180, 230, 280, 330, 30],
  8: [90, 135, 180, 225, 270, 315, 0, 45],
}

const angleToPosition = (angleDegrees: number): SeatPosition => {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    xPercent: Math.round((TABLE_CENTER.x + TABLE_RADIUS.x * Math.cos(radians)) * 10) / 10,
    yPercent: Math.round((TABLE_CENTER.y + TABLE_RADIUS.y * Math.sin(radians)) * 10) / 10,
  }
}

export const getSeatLayout = (seatCount: number): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 2), 8)
  const angles = angleSets[clamped]

  return angles.map((angle, index) => ({
    ...angleToPosition(angle),
    isHeroPosition: index === 0,
  }))
}
