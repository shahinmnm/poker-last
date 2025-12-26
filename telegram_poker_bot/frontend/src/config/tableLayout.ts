/**
 * The rendered table artwork is merely a visual cue; the player seats live on a
 * logical seat ring (an ellipse in percentage coordinates) that is then clamped
 * into the safe area so nothing overlaps the header or action bar.
 */
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

const SAFE_LEFT_PERCENT = 10
const SAFE_RIGHT_PERCENT = 90
const SAFE_TOP_PERCENT = 14
const SAFE_BOTTOM_PERCENT = 86

const TABLE_CENTER_X_PERCENT = 50
const TABLE_CENTER_Y_PERCENT = 55
const TABLE_SEAT_RADIUS_X_PERCENT = 48
const TABLE_SEAT_RADIUS_Y_PERCENT = 38
const LABEL_RADIUS_X = TABLE_SEAT_RADIUS_X_PERCENT + 8
const LABEL_RADIUS_Y = TABLE_SEAT_RADIUS_Y_PERCENT + 6

const HERO_ANGLE_DEG = 90

const ANGLES_BY_PLAYER_COUNT: Record<number, number[]> = {
  2: [HERO_ANGLE_DEG, 270],
  3: [HERO_ANGLE_DEG, 210, 330],
  4: [HERO_ANGLE_DEG, 210, 270, 330],
  5: [HERO_ANGLE_DEG, 210, 270, 330, 150],
  6: [HERO_ANGLE_DEG, 210, 270, 330, 150, 30],
  7: [HERO_ANGLE_DEG, 150, 210, 270, 330, 30, 90],
  8: [HERO_ANGLE_DEG, 135, 180, 225, 270, 315, 0, 45],
  9: [HERO_ANGLE_DEG, 130, 170, 210, 250, 290, 330, 10, 50],
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export const getSeatLayout = (playerCount: number): SeatLayoutSlot[] => {
  if (playerCount <= 0) {
    return []
  }

  const angles: number[] =
    playerCount === 1
      ? [HERO_ANGLE_DEG]
      : ANGLES_BY_PLAYER_COUNT[Math.min(playerCount, 9)]

  return angles.map((angleDeg, index) => {
    const angleRad = toRadians(angleDeg)

    const avatarX =
      TABLE_CENTER_X_PERCENT + TABLE_SEAT_RADIUS_X_PERCENT * Math.cos(angleRad)
    const avatarY =
      TABLE_CENTER_Y_PERCENT + TABLE_SEAT_RADIUS_Y_PERCENT * Math.sin(angleRad)

    const clampedX = clamp(avatarX, SAFE_LEFT_PERCENT, SAFE_RIGHT_PERCENT)
    const clampedY = clamp(avatarY, SAFE_TOP_PERCENT, SAFE_BOTTOM_PERCENT)

    const labelX =
      TABLE_CENTER_X_PERCENT + LABEL_RADIUS_X * Math.cos(angleRad)
    const labelY =
      TABLE_CENTER_Y_PERCENT + LABEL_RADIUS_Y * Math.sin(angleRad)

    return {
      seatIndex: index,
      angle: angleDeg,
      avatarX,
      avatarY,
      labelX: clamp(labelX, SAFE_LEFT_PERCENT, SAFE_RIGHT_PERCENT),
      labelY: clamp(labelY, SAFE_TOP_PERCENT, SAFE_BOTTOM_PERCENT),
      xPercent: clampedX,
      yPercent: clampedY,
      isHeroPosition: index === 0,
    }
  })
}
