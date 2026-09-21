/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core Primary Emerald / Mint System
        primary: {
          DEFAULT: 'rgb(var(--color-primary-500) / <alpha-value>)',
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          950: 'rgb(var(--color-primary-950) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-600) / <alpha-value>)',
          light: 'rgb(var(--color-primary-400) / <alpha-value>)',
          fixed: 'rgb(var(--color-primary-400) / <alpha-value>)',
          container: 'rgb(var(--color-primary-50) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-primary-600) / <alpha-value>)',
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          fixed: 'rgb(var(--color-primary-300) / <alpha-value>)',
          container: 'rgb(var(--color-primary-50) / <alpha-value>)',
        },
        'on-primary': '#ffffff',
        'on-primary-container': 'rgb(var(--color-primary-800) / <alpha-value>)',
        'on-secondary': '#ffffff',
        'on-secondary-container': 'rgb(var(--color-primary-900) / <alpha-value>)',

        // Semantic Status Feedback Colors
        success: {
          DEFAULT: '#10b981', // emerald-500
          dark: '#059669',
          light: '#34d399',
          container: '#ecfdf5',
          'on-container': '#065f46',
        },
        warning: {
          DEFAULT: '#f59e0b', // amber-500
          dark: '#d97706',
          light: '#fbbf24',
          container: '#fef3c7',
          'on-container': '#92400e',
        },
        danger: {
          DEFAULT: '#f43f5e', // rose-500
          dark: '#e11d48',
          light: '#fb7185',
          container: '#ffe4e6',
          'on-container': '#9f1239',
        },
        error: {
          DEFAULT: '#f43f5e', // rose-500
          dark: '#e11d48',
          light: '#fb7185',
          container: '#ffe4e6',
          'on-container': '#9f1239',
        },
        info: {
          DEFAULT: '#0ea5e9', // sky-500
          dark: '#0284c7',
          light: '#38bdf8',
          container: '#e0f2fe',
          'on-container': '#075985',
        },

        // Surface & Outline Compatibility Tokens (Addressing M3 & Legacy Classes)
        surface: {
          DEFAULT: '#ffffff',
          dim: '#f8fafc', // slate-50
          variant: '#f1f5f9', // slate-100
          container: '#f8fafc',
          'container-low': '#ffffff',
          'container-high': '#f1f5f9',
          'container-highest': '#e2e8f0', // slate-200
        },
        'on-surface': {
          DEFAULT: '#0f172a', // slate-900
          variant: '#64748b', // slate-500
          muted: '#94a3b8',   // slate-400
        },
        outline: {
          DEFAULT: '#cbd5e1', // slate-300
          variant: '#e2e8f0', // slate-200
          dim: '#f1f5f9',     // slate-100
        },
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'label-sm': ['0.6875rem', { lineHeight: '0.875rem', fontWeight: '600' }],
        'label-md': ['0.75rem', { lineHeight: '1rem', fontWeight: '600' }],
        'label-lg': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.125rem' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'headline-sm': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        'headline-md': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        'headline-lg': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '800' }],
      },
      spacing: {
        'xs': '0.25rem',   // 4px
        'sm': '0.5rem',    // 8px
        'md': '1rem',      // 16px
        'lg': '1.5rem',    // 24px
        'xl': '2rem',      // 32px
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
