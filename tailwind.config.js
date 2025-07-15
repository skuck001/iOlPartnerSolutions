/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // IoL Brand Colors
        iol: {
          black: '#1a1a1a',
          'black-light': '#2a2a2a',
          'black-lighter': '#3a3a3a',
          red: '#dc2626',
          'red-dark': '#b91c1c',
          'red-light': '#ef4444',
          white: '#ffffff',
          'gray-light': '#f8f9fa',
          'gray-medium': '#6b7280',
          'gray-dark': '#374151',
        },
        // Updated primary colors to use IoL red
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626', // iOL red as the main primary color
          600: '#dc2626', // iOL red
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Dark theme grays
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      }
    },
  },
  plugins: [],
} 