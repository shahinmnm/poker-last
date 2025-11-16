module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic color tokens - use CSS variables
        bg: 'var(--app-background)',
        surface: {
          DEFAULT: 'var(--surface-base)',
          muted: 'var(--surface-overlay)',
          border: 'var(--surface-border)',
        },
        accent: {
          DEFAULT: 'var(--accent-start)',
          end: 'var(--accent-end)',
          soft: 'var(--accent-soft)',
        },
        text: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-muted)',
        },
      },
      boxShadow: {
        card: 'var(--shadow-elevated)',
        button: 'var(--shadow-button)',
        glow: 'var(--shadow-glow)',
      },
      borderRadius: {
        card: '26px',
        button: '9999px',
        pill: '9999px',
      },
      fontFamily: {
        display: 'var(--font-display)',
        farsi: 'var(--font-farsi)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
