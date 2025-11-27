export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 55 }
const TABLE_RADIUS = { x: 28, y: 20 }

const angleSets: Record<number, number[]> = {
  2: [90, 270],
  3: [90, 210, 330],
  4: [90, 210, 270, 330],
  5: [90, 150, 210, 330, 30],
  6: [90, 130, 200, 270, 340, 50],
  7: [90, 130, 170, 230, 310, 340, 50],
  8: [90, 120, 170, 220, 270, 320, 20, 60],
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
