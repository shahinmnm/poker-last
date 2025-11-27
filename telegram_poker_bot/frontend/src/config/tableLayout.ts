export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 50 }

// Ellipse radius as percentage - should match the table CSS border
const TABLE_ELLIPSE_RADIUS_X_PERCENT = 49 // horizontal radius (% of width)
const TABLE_ELLIPSE_RADIUS_Y_PERCENT = 46 // vertical radius (% of height)

// Profile offset from table edge (0 = on edge, negative = inside, positive = outside)
const PROFILE_OFFSET_PERCENT = 0

const roundToTenth = (value: number) => Math.round(value * 10) / 10

const angleToPosition = (angleDegrees: number): SeatPosition => {
  const radians = (angleDegrees * Math.PI) / 180

  const effectiveRadiusX = TABLE_ELLIPSE_RADIUS_X_PERCENT + PROFILE_OFFSET_PERCENT
  const effectiveRadiusY = TABLE_ELLIPSE_RADIUS_Y_PERCENT + PROFILE_OFFSET_PERCENT

  return {
    xPercent: roundToTenth(TABLE_CENTER.x + effectiveRadiusX * Math.cos(radians)),
    yPercent: roundToTenth(TABLE_CENTER.y + effectiveRadiusY * Math.sin(radians)),
  }
}

export const getSeatLayout = (seatCount: number): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 1), 8)
  const step = 360 / clamped
  const startAngle = 90 // Start from bottom (hero position)

  return Array.from({ length: clamped }, (_, index) => {
    const angle = startAngle + step * index
    return {
      ...angleToPosition(angle),
      isHeroPosition: index === 0,
    }
  })
}
