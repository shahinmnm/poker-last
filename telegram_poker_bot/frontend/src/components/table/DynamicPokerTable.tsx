import type { TemplateUISchema } from '@/types'
import { computeSeatPositions } from '@/modules/table/layout'

interface DynamicPokerTableProps {
  template?: TemplateUISchema
}

const fallbackSchema: TemplateUISchema = {
  layout: { type: 'ring', seat_count: 6, radius: 140, avatar_size: 52, card_scale: 1 },
  theme: {
    table_color: '#0b3d2e',
    felt_pattern: 'classic',
    accent_color: '#ffcc00',
    ui_color_mode: 'dark',
  },
  timers: { avatar_ring: true, ring_color: '#00ffc6', ring_thickness: 3 },
  icons: { table_icon: '🃏', stake_label: 'Blinds', variant_badge: 'NLH' },
  rules_display: { show_blinds: true, show_speed: true, show_buyin: true },
}

export default function DynamicPokerTable({ template }: DynamicPokerTableProps) {
  const schema = template ?? fallbackSchema
  const { layout, theme, timers, icons } = schema
  const positions = computeSeatPositions(layout.seat_count, layout.radius)
  const tableSize = layout.radius * 2 + layout.avatar_size * 2

  return (
    <div
      style={{
        width: tableSize,
        height: tableSize,
        position: 'relative',
        margin: '0 auto',
        borderRadius: '9999px',
        background: `radial-gradient(circle at 30% 30%, ${theme.table_color}, ${
          theme.ui_color_mode === 'dark' ? '#0a2a1f' : '#e6f2eb'
        })`,
        boxShadow: `0 20px 50px rgba(0,0,0,0.25), inset 0 0 0 8px ${theme.accent_color}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: layout.avatar_size / 2,
          borderRadius: layout.type === 'oval' ? '50% / 40%' : '50%',
          background:
            theme.ui_color_mode === 'dark'
              ? `radial-gradient(circle, rgba(255,255,255,0.04), rgba(0,0,0,0.25)), ${theme.table_color}`
              : `radial-gradient(circle, rgba(0,0,0,0.05), rgba(255,255,255,0.2)), ${theme.table_color}`,
          border: `2px dashed ${theme.accent_color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.accent_color,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>{icons.table_icon}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{icons.stake_label}</div>
          <div
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: theme.ui_color_mode === 'dark' ? '#0f4d34' : '#fff',
              color: theme.ui_color_mode === 'dark' ? '#eafff5' : '#0f4d34',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              fontSize: 12,
            }}
          >
            <span>{icons.variant_badge}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent_color }} />
            <span>{layout.seat_count} seats</span>
          </div>
        </div>
      </div>

      {positions.map((pos, idx) => {
        const baseSize = layout.avatar_size
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              width: baseSize,
              height: baseSize,
              borderRadius: '50%',
              left: pos.x + baseSize / 2,
              top: pos.y + baseSize / 2,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            }}
          >
            {timers.avatar_ring && (
              <div
                style={{
                  position: 'absolute',
                  inset: -timers.ring_thickness,
                  borderRadius: '50%',
                  border: `${timers.ring_thickness}px solid ${timers.ring_color}`,
                  opacity: 0.8,
                }}
              />
            )}
            <div
              style={{
                width: baseSize - timers.ring_thickness * 2,
                height: baseSize - timers.ring_thickness * 2,
                borderRadius: '50%',
                background: theme.ui_color_mode === 'dark' ? '#142c21' : '#f6fffb',
                color: theme.ui_color_mode === 'dark' ? '#e6fff6' : '#0b3d2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              S{idx + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}
