/**
 * AppBackground - Royal Velvet Casino Arena
 * 
 * Creates a high-end casino table aesthetic with a radial velvet gradient.
 * Features:
 * - Layer 1: Royal Velvet Gradient (green spotlight → dark green → void black)
 * - Layer 2: Subtle noise texture for velvet fabric effect
 * - No blurs, no light mode, crisp Pro Mode only
 */

import './AppBackground.css'

export default function AppBackground() {
  return (
    <div className="app-background">
      {/* Layer 1: Royal Velvet Gradient */}
      <div className="app-background__base" />

      {/* Layer 2: Subtle noise texture for velvet effect */}
      <div className="app-background__noise" />
    </div>
  )
}
