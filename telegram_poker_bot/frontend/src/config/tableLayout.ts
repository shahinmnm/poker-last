export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 50 }
const TABLE_RADIUS = { x: 47.5, y: 36 }
const TABLE_INSET_PX = 14
const TABLE_BORDER_WIDTH_PX = 10
const SEAT_RING_OFFSET_PX = TABLE_INSET_PX + TABLE_BORDER_WIDTH_PX / 2

type TableSize = {
  width: number
  height: number
}

const roundToTenth = (value: number) => Math.round(value * 10) / 10

const angleToPosition = (angleDegrees: number, tableSize?: TableSize): SeatPosition => {
  const radians = (angleDegrees * Math.PI) / 180

  if (tableSize) {
    const centerX = tableSize.width / 2
    const centerY = tableSize.height / 2
    const radiusX = Math.max(centerX - SEAT_RING_OFFSET_PX, 0)
    const radiusY = Math.max(centerY - SEAT_RING_OFFSET_PX, 0)

    return {
      xPercent: roundToTenth(((centerX + radiusX * Math.cos(radians)) / tableSize.width) * 100),
      yPercent: roundToTenth(((centerY + radiusY * Math.sin(radians)) / tableSize.height) * 100),
    }
  }

  return {
    xPercent: roundToTenth(TABLE_CENTER.x + TABLE_RADIUS.x * Math.cos(radians)),
    yPercent: roundToTenth(TABLE_CENTER.y + TABLE_RADIUS.y * Math.sin(radians)),
  }
}

export const getSeatLayout = (seatCount: number, tableSize?: TableSize): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 1), 8)
  const step = 360 / clamped
  const startAngle = 90

  return Array.from({ length: clamped }, (_, index) => {
    const angle = startAngle + step * index
    return {
      ...angleToPosition(angle, tableSize),
      isHeroPosition: index === 0,
    }
  })
}
