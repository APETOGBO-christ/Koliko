/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0e0820',
        deep: '#160d30',
        'clay-a': '#2a1860',
        'clay-b': '#371e78',
        core: '#7c3aed',
        light: '#a78bfa',
        t1: '#ffffff',
        t2: '#c4b5fd',
        t3: '#6b7280',
        t4: '#374151',
        ok: '#10b981',
        warn: '#f59e0b',
        err: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        clay: '20px',
      },
    },
  },
  plugins: [],
}
