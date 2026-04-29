import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ember: '#E85D26',
        gold: '#C8A45A',
        ink: '#1A1510',
        paper: '#F5F0E8',
        mid: '#6B5F56',
        cream: '#FAF7F2',
        teal: '#1A7A9A',
        charcoal: '#2C2520',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace'],
        data: ['Space Grotesk', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,21,16,0.06), 0 1px 2px rgba(26,21,16,0.04)',
        'card-hover': '0 4px 20px rgba(26,21,16,0.08)',
        modal: '0 24px 80px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}

export default config
