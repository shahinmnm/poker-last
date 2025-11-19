# AppBackground Component

## Overview

The `AppBackground` component provides a multi-layered, glassmorphism-friendly background for the Telegram Poker Mini-App. It creates depth and atmosphere through blurred color blobs, gradients, soft shapes, and neon glows while ensuring glass UI elements stand out with proper transparency and blur support.

## Design Principles

This implementation follows modern glassmorphism principles inspired by:
- **Apple iOS blur environments** - Layered translucent surfaces with backdrop blur
- **Flutter glass_kit showcase** - Multi-layer gradient backgrounds with color blobs
- **Neo-brutalist gradients** - Bold color combinations with soft, organic shapes
- **Poker-themed neon aesthetics** - Violet, purple, cyan, and gold accents

## Architecture

The component uses a **4-layer approach** for maximum depth and visual interest:

### Layer 1: Base Gradient
- **Dark Mode**: Deep navy → midnight purple → muted teal (`#050816` → `#0A0F2B` → `#091727`)
- **Light Mode**: Soft lavender → off-white → pastel pink (`#F4F2FF` → `#FFF6FA` → `#F9FBFF`)
- Creates the foundational color wash

### Layer 2: Large Blurred Color Blobs
- **Dark Mode Palette**:
  - Neon purple (`#7C3AED`) - 16% opacity, 180px blur
  - Cyan (`#22D3EE`) - 14% opacity, 200px blur
  - Gold (`#FBBF24`) - 12% opacity, 220px blur
  - Deep blue (`#0EA5E9`) - 15% opacity, 260px blur
  
- **Light Mode Palette**:
  - Lavender (`#C4B5FD`) - 12% opacity, 150px blur
  - Baby blue (`#93C5FD`) - 10% opacity, 160px blur
  - Peach (`#FECACA`) - 8% opacity, 140px blur
  - Sky blue (`#BAE6FD`) - 9% opacity, 120px blur

### Layer 3: Soft Shape Accents
- Organic elliptical shapes positioned in corners and center
- Lower opacity (4-7% dark, 4-6% light)
- Additional blur (35-80px) for atmospheric effect
- Randomized border-radius for organic feel

### Layer 4: Subtle Noise Texture
- CSS-based repeating radial gradient pattern
- 2.5-4% opacity depending on theme
- Prevents flat, overly-digital appearance
- Uses `mix-blend-mode: overlay` for integration

## Theme Support

The background seamlessly adapts to theme changes via the `data-theme` attribute:

```tsx
<div className="app-background" data-theme={mode}>
  {/* Layers automatically switch based on theme */}
</div>
```

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` easing over 0.6s for smooth theme switching.

## Performance Optimizations

1. **GPU Acceleration**:
   - `transform: translateZ(0)` on all layers
   - `backface-visibility: hidden`
   - Forces hardware compositing

2. **Reduced Motion Support**:
   - Respects `prefers-reduced-motion: reduce`
   - Disables transitions for accessibility

3. **Mobile Optimization**:
   - Blobs and shapes scale to 70% on screens < 640px
   - Reduces GPU memory usage on mobile devices

## Integration

The component is integrated at the root level in `MainLayout.tsx`:

```tsx
return (
  <>
    <AppBackground />
    <div className="relative flex min-h-screen flex-col">
      {/* App content with relative positioning */}
    </div>
  </>
)
```

This ensures:
- Background sits at `z-index: 0` (fixed position)
- All content appears above with `position: relative`
- No interference with existing layout

## Glassmorphism Enhancement

The background enhances glass components by:
1. **Providing color depth** - Blobs create varied backgrounds for glass surfaces to blur
2. **Creating visual hierarchy** - Darker/lighter areas guide user attention
3. **Supporting transparency** - Low opacity ensures glass elements remain legible
4. **Enabling blur effects** - Color variation makes backdrop-filter visible

## Browser Compatibility

- Modern browsers with CSS backdrop-filter support
- Graceful degradation: background still renders without blur effects
- Tested on Chrome, Safari, Firefox, Edge

## File Structure

```
src/components/background/
├── AppBackground.tsx       # React component
├── AppBackground.css       # Complete styling
└── README.md              # This documentation
```

## Customization

To adjust colors, modify the CSS variables in `AppBackground.css`:

```css
/* Example: Change dark mode blob color */
.app-background[data-theme='dark'] .app-background__blob--1 {
  background: radial-gradient(circle, #YOUR_COLOR 0%, transparent 70%);
  opacity: 0.16;
  filter: blur(180px);
}
```

## Future Enhancements

Potential improvements:
- Animated blob movement (subtle CSS animations)
- Dynamic blob colors based on poker game state
- Canvas-based particle effects for premium feel
- Seasonal theme variations

## Credits

Design inspired by modern glassmorphism trends in iOS, Material You, and Fluent Design System.
