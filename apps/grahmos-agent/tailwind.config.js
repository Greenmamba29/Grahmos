/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Grahmos brand colors
        grahmos: {
          primary: '#e11d48',     // Emergency red
          secondary: '#0ea5e9',   // Info blue  
          success: '#10b981',     // Safe green
          warning: '#f59e0b',     // Warning amber
          background: '#0f172a',  // Dark slate
          surface: '#1e293b',     // Slate 800
        }
      },
      animation: {
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
        'slide-down': 'slide-down 0.3s ease-out',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}