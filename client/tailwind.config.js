/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#161412',
          light: '#211d19',
          lighter: '#2b2620',
        },
        cream: {
          DEFAULT: '#f2ead9',
          dim: '#c9bfab',
        },
        barber: {
          red: '#a3352c',
          'red-light': '#c14a3f',
        },
        brass: {
          DEFAULT: '#c9a24b',
          light: '#e0c37a',
          dark: '#9c7c34',
        },
      },
      fontFamily: {
        heading: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      boxShadow: {
        ticket: '0 4px 0 0 rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        stripes:
          'repeating-linear-gradient(135deg, var(--tw-gradient-stops) 0 10px)',
      },
    },
  },
  plugins: [],
}
