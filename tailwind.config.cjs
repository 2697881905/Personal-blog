/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        background: '#0e0f13',
        surface: 'rgba(255, 255, 255, 0.04)',
        'surface-strong': 'rgba(12, 13, 17, 0.6)',
        card: '#12141a',
        border: 'rgba(255, 255, 255, 0.10)',
        text: '#e9ebef',
        muted: '#9aa1ac',
        accent: '#d9b382',
        'accent-strong': '#ecd9bd'
      },
      fontFamily: {
        sans: [
          'Outfit',
          'PingFang SC',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          '-apple-system',
          'sans-serif'
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      letterSpacing: {
        eyebrow: '0.18em'
      },
      maxWidth: {
        prose: '65ch'
      }
    }
  },
  plugins: []
};
