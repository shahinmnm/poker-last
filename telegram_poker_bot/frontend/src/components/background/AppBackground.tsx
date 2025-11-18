/**
 * AppBackground - Layered glassmorphism-friendly background
 * 
 * Creates a multi-layered abstract background that enhances glass components
 * with blurred color blobs, gradients, soft shapes, and neon glows.
 * 
 * Features:
 * - Layer 1: Base gradient (theme-aware)
 * - Layer 2: Large blurred color blobs
 * - Layer 3: Soft shape accents
 * - Layer 4: Subtle noise texture
 * - Full light/dark mode support
 * - Smooth theme transitions
 */

import { useTheme } from '../../providers/ThemeProvider'
import './AppBackground.css'

export default function AppBackground() {
  const { mode } = useTheme()

  return (
    <div className="app-background" data-theme={mode}>
      {/* Layer 1: Base gradient */}
      <div className="app-background__base" />

      {/* Layer 2: Large blurred color blobs */}
      <div className="app-background__blobs">
        <div className="app-background__blob app-background__blob--1" />
        <div className="app-background__blob app-background__blob--2" />
        <div className="app-background__blob app-background__blob--3" />
        <div className="app-background__blob app-background__blob--4" />
      </div>

      {/* Layer 3: Soft shape accents */}
      <div className="app-background__shapes">
        <div className="app-background__shape app-background__shape--1" />
        <div className="app-background__shape app-background__shape--2" />
        <div className="app-background__shape app-background__shape--3" />
      </div>

      {/* Layer 4: Subtle noise texture */}
      <div className="app-background__noise" />
    </div>
  )
}
