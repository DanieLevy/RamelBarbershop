import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '360px',
      },
      colors: {
        brand: {
          primary: '#7A5230',
          secondary: '#B08B5B',
          leather: '#8B4513',
          copper: '#B87333',
          cream: '#FFFDD0',
        },
        background: {
          dark: '#080b0d',
          darker: '#050708',
          card: 'rgba(26, 26, 26, 0.8)',
          'card-solid': '#1a1a1a',
        },
        foreground: {
          light: '#F2F2F2',
          muted: '#717171',
          cream: '#FFFDD0',
        },
        accent: {
          orange: '#D35400',
          gold: '#ffaa3d',
          'gold-light': '#ffc46d',
          'gold-dark': '#cc8830',
        },
        vintage: {
          paper: '#f4e4bc',
          ink: '#2c1810',
          rust: '#8b3a3a',
          brass: '#b5a642',
        },
      },
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
        cereal: ['AirbnbCereal', 'sans-serif'],
      },
      animation: {
        'spin-scissors': 'spin-scissors 1.5s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'slide-in-up': 'slide-in-up 0.3s ease-out forwards',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'barber-pole': 'barber-pole 2s linear infinite',
      },
      keyframes: {
        'spin-scissors': {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-20deg) scale(1.1)' },
          '50%': { transform: 'rotate(0deg) scale(1)' },
          '75%': { transform: 'rotate(20deg) scale(1.1)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 170, 61, 0.4)' },
          '50%': { boxShadow: '0 0 20px 10px rgba(255, 170, 61, 0.1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'barber-pole': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 50px' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'gold': '0 4px 20px rgba(255, 170, 61, 0.3)',
        'gold-lg': '0 8px 40px rgba(255, 170, 61, 0.4)',
        'dark': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'inner-gold': 'inset 0 0 20px rgba(255, 170, 61, 0.1)',
      },
      borderWidth: {
        '3': '3px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      transitionDuration: {
        '400': '400ms',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
}

export default config
