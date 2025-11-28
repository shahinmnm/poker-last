export interface SeatLayoutSlot {
  seatIndex: number
  angle: number
  avatarX: number
  avatarY: number
  labelX: number
  labelY: number
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

const TABLE_CENTER = { x: 50, y: 50 }

const TABLE_ELLIPSE_RADIUS_X_PERCENT = 49
const TABLE_ELLIPSE_RADIUS_Y_PERCENT = 46
const PROFILE_OFFSET_PERCENT = 0
const LABEL_OFFSET_PERCENT = 3

const YOU_ANGLE = 90 // bottom of the ellipse
const ALLOWED_ARC_START = -150
const ALLOWED_ARC_END = -30
const MAX_ALLOWED_ARC_WIDTH = 150

const roundToTenth = (value: number) => Math.round(value * 10) / 10

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360

const getArcWidth = (start: number, end: number) => {
  const width = normalizeAngle(end - start)
  return width === 0 ? 360 : width
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const computeEllipsePoint = (angleDegrees: number, radiusX: number, radiusY: number) => {
  const radians = toRadians(angleDegrees)
  return {
    x: TABLE_CENTER.x + radiusX * Math.cos(radians),
    y: TABLE_CENTER.y + radiusY * Math.sin(radians),
  }
}

export const getSeatLayout = (seatCount: number): SeatLayoutSlot[] => {
  const clampedSeatCount = Math.max(1, seatCount)
  const othersCount = Math.max(clampedSeatCount - 1, 0)
  const minSeparationAngle = 360 / (clampedSeatCount + 1)

  const baseStart = normalizeAngle(ALLOWED_ARC_START)
  const baseEnd = normalizeAngle(ALLOWED_ARC_END)
  const baseArcWidth = getArcWidth(baseStart, baseEnd)
  const arcCenter = normalizeAngle(baseStart + baseArcWidth / 2)

  let arcWidth = baseArcWidth
  if (othersCount > 1) {
    const requiredArcWidth = minSeparationAngle * (othersCount - 1)
    arcWidth = Math.min(Math.max(arcWidth, requiredArcWidth), MAX_ALLOWED_ARC_WIDTH)
  }

  const expandedStart = normalizeAngle(arcCenter - arcWidth / 2)

  const angleSlots: number[] = [YOU_ANGLE]
  if (othersCount === 1) {
    angleSlots.push(normalizeAngle(arcCenter))
  } else if (othersCount > 1) {
    const step = arcWidth / (othersCount - 1)
    for (let index = 0; index < othersCount; index += 1) {
      angleSlots.push(normalizeAngle(expandedStart + step * index))
    }
  }

  const effectiveRadiusX = TABLE_ELLIPSE_RADIUS_X_PERCENT + PROFILE_OFFSET_PERCENT
  const effectiveRadiusY = TABLE_ELLIPSE_RADIUS_Y_PERCENT + PROFILE_OFFSET_PERCENT
  const labelScale = effectiveRadiusY / (effectiveRadiusY + LABEL_OFFSET_PERCENT)

  return angleSlots.map((angle, index) => {
    const { x: avatarXRaw, y: avatarYRaw } = computeEllipsePoint(
      angle,
      effectiveRadiusX,
      effectiveRadiusY,
    )

    const avatarX = roundToTenth(avatarXRaw)
    const avatarY = roundToTenth(avatarYRaw)

    const labelXRaw = avatarX
    const labelYRaw = avatarY + LABEL_OFFSET_PERCENT

    const labelX = roundToTenth(
      TABLE_CENTER.x + (labelXRaw - TABLE_CENTER.x) * labelScale,
    )
    const labelY = roundToTenth(
      TABLE_CENTER.y + (labelYRaw - TABLE_CENTER.y) * labelScale,
    )

    return {
      seatIndex: index,
      angle,
      avatarX,
      avatarY,
      labelX,
      labelY,
      xPercent: avatarX,
      yPercent: avatarY,
      isHeroPosition: index === 0,
    }
  })
}
