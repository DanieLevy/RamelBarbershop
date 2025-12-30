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
        '3xl': '1920px',
      },
      colors: {
        background: {
          dark: '#080b0d',
          darker: '#050708',
          card: 'rgba(26, 26, 26, 0.8)',
          'card-solid': '#1a1a1a',
          'hero': 'rgba(8, 11, 13, 0.6)',
        },
        foreground: {
          light: '#F2F2F2',
          muted: '#717171',
          subtle: '#4a4a4a',
        },
        accent: {
          orange: '#D35400',
          gold: '#ffaa3d',
          'gold-light': '#ffc46d',
          'gold-dark': '#cc8830',
          'gold-muted': 'rgba(255, 170, 61, 0.6)',
        },
        status: {
          available: '#22c55e',
          busy: '#eab308',
          offline: '#ef4444',
        },
      },
      fontFamily: {
        ploni: ['Ploni', 'Rubik', 'sans-serif'],
      },
      fontSize: {
        'hero': ['clamp(2.5rem, 8vw, 4.5rem)', { lineHeight: '1.1' }],
        'hero-sub': ['clamp(1rem, 3vw, 1.5rem)', { lineHeight: '1.4' }],
      },
      animation: {
        'spin-scissors': 'spin-scissors 1.5s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-in-up': 'slide-in-up 0.3s ease-out forwards',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 4s ease-in-out infinite 1s',
        'reveal-up': 'reveal-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-scale': 'reveal-scale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-fade': 'reveal-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scroll-hint': 'scroll-hint 2s ease-in-out infinite',
        'gradient-x': 'gradient-x 4s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
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
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-scale': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'reveal-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scroll-hint': {
          '0%, 100%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(8px)', opacity: '0.5' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 20px rgba(255, 170, 61, 0.3))' },
          '50%': { filter: 'drop-shadow(0 0 40px rgba(255, 170, 61, 0.6))' },
        },
        'barber-pole': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 50px' },
        },
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '48px',
      },
      boxShadow: {
        'gold': '0 4px 20px rgba(255, 170, 61, 0.3)',
        'gold-lg': '0 8px 40px rgba(255, 170, 61, 0.4)',
        'gold-glow': '0 0 60px rgba(255, 170, 61, 0.25)',
        'dark': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'dark-lg': '0 16px 48px rgba(0, 0, 0, 0.6)',
        'inner-gold': 'inset 0 0 20px rgba(255, 170, 61, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.25)',
        'glass-elevated': '0 16px 48px rgba(0, 0, 0, 0.35)',
      },
      borderWidth: {
        '3': '3px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'reveal': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gold-gradient': 'linear-gradient(135deg, #ffaa3d 0%, #ffc46d 50%, #ffaa3d 100%)',
        'dark-gradient': 'linear-gradient(180deg, #080b0d 0%, #050708 100%)',
        'hero-gradient': 'linear-gradient(180deg, transparent 0%, rgba(8, 11, 13, 0.8) 100%)',
      },
    },
  },
  plugins: [],
}

export default config
