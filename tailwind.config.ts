import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        'dark-bg': '#0f172a',
        'dark-card': '#1e293b',
        'dark-border': '#334155',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        // Legacy animations (kept for backward compatibility)
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
        // Premium animations - micro interactions
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-out': 'scale-out 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up-fade': 'slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down-fade': 'slide-down-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-left-fade': 'slide-left-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right-fade': 'slide-right-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'blur-in': 'blur-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        // Premium animations - visual effects
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shine': 'shine-sweep 2s ease-in-out infinite',
        'live-indicator': 'live-indicator 2s ease-in-out infinite',
        // Premium animations - data feedback
        'profit-flash': 'profit-flash 0.6s ease-out',
        'loss-flash': 'loss-flash 0.6s ease-out',
        'number-morph': 'number-morph 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'count-up': 'count-up 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        // Premium animations - achievements & rewards
        'achievement-unlock': 'achievement-unlock 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'confetti-burst': 'confetti-burst 1s cubic-bezier(0.16, 1, 0.3, 1)',
        'badge-shine': 'badge-shine 2s ease-in-out infinite',
        // Skeleton loading
        'skeleton-pulse': 'skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        // Legacy keyframes
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(14, 165, 233, 0.5)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        // Premium keyframes - micro interactions
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        'slide-up-fade': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down-fade': {
          '0%': { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-left-fade': {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-right-fade': {
          '0%': { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'blur-in': {
          '0%': { filter: 'blur(8px)', opacity: '0' },
          '100%': { filter: 'blur(0)', opacity: '1' },
        },
        // Premium keyframes - visual effects
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.3), 0 0 40px rgba(212, 175, 55, 0.1)',
            filter: 'brightness(1)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.5), 0 0 60px rgba(212, 175, 55, 0.2)',
            filter: 'brightness(1.1)',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shine-sweep': {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'live-indicator': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0.5' },
        },
        // Premium keyframes - data feedback
        'profit-flash': {
          '0%': { backgroundColor: 'transparent' },
          '25%': { backgroundColor: 'rgba(16, 185, 129, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'loss-flash': {
          '0%': { backgroundColor: 'transparent' },
          '25%': { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'number-morph': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'count-up': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Premium keyframes - achievements
        'achievement-unlock': {
          '0%': { transform: 'scale(0) rotate(-15deg)', opacity: '0' },
          '50%': { transform: 'scale(1.1) rotate(5deg)' },
          '75%': { transform: 'scale(0.95) rotate(-2deg)' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        'confetti-burst': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'badge-shine': {
          '0%': { backgroundPosition: '-100% center' },
          '50%, 100%': { backgroundPosition: '200% center' },
        },
        // Skeleton loading
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      // Premium transitions
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      transitionDuration: {
        'micro': '100ms',
        'fast': '200ms',
        'normal': '300ms',
        'slow': '500ms',
        'luxe': '600ms',
      },
      // Premium box shadows
      boxShadow: {
        'glow-sm': '0 0 10px rgba(212, 175, 55, 0.3)',
        'glow-md': '0 0 20px rgba(212, 175, 55, 0.4)',
        'glow-lg': '0 0 30px rgba(212, 175, 55, 0.5)',
        'glow-xl': '0 0 40px rgba(212, 175, 55, 0.6)',
        'profit': '0 0 20px rgba(16, 185, 129, 0.4)',
        'loss': '0 0 20px rgba(239, 68, 68, 0.4)',
        'card-hover': '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(212, 175, 55, 0.1)',
        'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(212, 175, 55, 0.15)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
