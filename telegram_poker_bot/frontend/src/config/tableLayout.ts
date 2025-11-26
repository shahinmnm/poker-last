export interface SeatPosition {
  xPercent: number
  yPercent: number
  isHeroPosition?: boolean
}

export const mobileSeatLayout: Record<number, SeatPosition[]> = {
  2: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 50, yPercent: 20 },
  ],
  3: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 26, yPercent: 26 },
    { xPercent: 74, yPercent: 26 },
  ],
  4: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 22, yPercent: 34 },
    { xPercent: 50, yPercent: 20 },
    { xPercent: 78, yPercent: 34 },
  ],
  5: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 18, yPercent: 40 },
    { xPercent: 38, yPercent: 24 },
    { xPercent: 62, yPercent: 24 },
    { xPercent: 82, yPercent: 40 },
  ],
  6: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 18, yPercent: 48 },
    { xPercent: 34, yPercent: 28 },
    { xPercent: 50, yPercent: 18 },
    { xPercent: 66, yPercent: 28 },
    { xPercent: 82, yPercent: 48 },
  ],
  7: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 16, yPercent: 52 },
    { xPercent: 30, yPercent: 34 },
    { xPercent: 44, yPercent: 22 },
    { xPercent: 56, yPercent: 22 },
    { xPercent: 70, yPercent: 34 },
    { xPercent: 84, yPercent: 52 },
  ],
  8: [
    { xPercent: 50, yPercent: 82, isHeroPosition: true },
    { xPercent: 16, yPercent: 54 },
    { xPercent: 30, yPercent: 36 },
    { xPercent: 44, yPercent: 22 },
    { xPercent: 56, yPercent: 18 },
    { xPercent: 70, yPercent: 22 },
    { xPercent: 84, yPercent: 36 },
    { xPercent: 50, yPercent: 32 },
  ],
}

export const getSeatLayout = (seatCount: number): SeatPosition[] => {
  const clamped = Math.min(Math.max(seatCount, 2), 8)
  return mobileSeatLayout[clamped]
}
