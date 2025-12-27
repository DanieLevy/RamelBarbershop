import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#7A5230',
          secondary: '#B08B5B',
        },
        background: {
          dark: '#080b0d',
          card: 'rgba(65, 65, 65, 0.308)',
        },
        foreground: {
          light: '#F2F2F2',
          muted: '#717171',
        },
        accent: {
          orange: '#D35400',
          gold: '#ffaa3d',
        },
      },
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
        cereal: ['AirbnbCereal', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

