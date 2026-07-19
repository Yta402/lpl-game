/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 电竞深色基底
        ink: {
          950: '#0a0e1a',
          900: '#0f1424',
          850: '#141b30',
          800: '#1a2238',
          700: '#243049',
          600: '#334155',
        },
        gold: { DEFAULT: '#f5c451', dark: '#c9962f' },
        cyan: { DEFAULT: '#22d3ee', dark: '#0e7490' },
        // 三组属性配色
        laning: '#fb7185',    // 对线组 红橙
        teamfight: '#38bdf8', // 团战组 青蓝
        depth: '#a78bfa',     // 深度组 紫
        win: '#34d399',
        lose: '#f87171',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Consolas', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(245,196,81,0.25)',
        cyan: '0 0 20px rgba(34,211,238,0.25)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideUp: 'slideUp 0.4s ease-out',
        pulse2: 'pulse2 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
