export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 54 }
const TABLE_RADIUS = { x: 47.5, y: 47.5 }

const PRESET_LAYOUTS: Record<number, SeatPosition[]> = {
  2: [
    { xPercent: 50, yPercent: 86, isHeroPosition: true },
    { xPercent: 50, yPercent: 22 },
  ],
  3: [
    { xPercent: 50, yPercent: 86, isHeroPosition: true },
    { xPercent: 26, yPercent: 30 },
    { xPercent: 74, yPercent: 30 },
  ],
  4: [
    { xPercent: 50, yPercent: 88, isHeroPosition: true },
    { xPercent: 22, yPercent: 64 },
    { xPercent: 50, yPercent: 22 },
    { xPercent: 78, yPercent: 64 },
  ],
  5: [
    { xPercent: 50, yPercent: 88, isHeroPosition: true },
    { xPercent: 24, yPercent: 70 },
    { xPercent: 30, yPercent: 32 },
    { xPercent: 70, yPercent: 32 },
    { xPercent: 76, yPercent: 70 },
  ],
  6: [
    { xPercent: 50, yPercent: 88, isHeroPosition: true },
    { xPercent: 22, yPercent: 70 },
    { xPercent: 28, yPercent: 34 },
    { xPercent: 50, yPercent: 18 },
    { xPercent: 72, yPercent: 34 },
    { xPercent: 78, yPercent: 70 },
  ],
}

const angleToPosition = (angleDegrees: number): SeatPosition => {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    xPercent: Math.round((TABLE_CENTER.x + TABLE_RADIUS.x * Math.cos(radians)) * 10) / 10,
    yPercent: Math.round((TABLE_CENTER.y + TABLE_RADIUS.y * Math.sin(radians)) * 10) / 10,
  }
}

export const getSeatLayout = (seatCount: number): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 1), 8)

  if (PRESET_LAYOUTS[clamped]) {
    return PRESET_LAYOUTS[clamped]
  }

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
