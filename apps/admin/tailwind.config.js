/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Override with CSS custom properties for dynamic theming
        primary: 'var(--tenant-primary)',
        secondary: 'var(--tenant-secondary)',
        accent: 'var(--tenant-accent)',
        background: 'var(--tenant-background)',
        surface: 'var(--tenant-surface)',
        // Accessible color variations
        'primary-foreground': 'var(--tenant-primary-foreground)',
        'primary-hover': 'var(--tenant-primary-hover)',
        'primary-light': 'var(--tenant-primary-light)',
        'primary-dark': 'var(--tenant-primary-dark)',
        'text-primary': 'var(--tenant-text-primary)',
        'text-secondary': 'var(--tenant-text-secondary)',
        'border-primary': 'var(--tenant-border-primary)',
      },
      fontFamily: {
        heading: 'var(--tenant-font-heading)',
        body: 'var(--tenant-font-body)',
      },
      fontSize: {
        // Scale font sizes for accessibility (senior users)
        'access-xs': ['0.875rem', { lineHeight: '1.5rem' }],
        'access-sm': ['1rem', { lineHeight: '1.75rem' }],
        'access-base': ['1.125rem', { lineHeight: '1.75rem' }],
        'access-lg': ['1.25rem', { lineHeight: '2rem' }],
        'access-xl': ['1.5rem', { lineHeight: '2rem' }],
        'access-2xl': ['1.875rem', { lineHeight: '2.25rem' }],
        'access-3xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        // Increased spacing for better touch targets
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        // Ensure minimum touch target sizes
        '12': '3rem',
        '14': '3.5rem',
        '16': '4rem',
      },
      minWidth: {
        '12': '3rem',
        '14': '3.5rem',
        '16': '4rem',
      },
      borderRadius: {
        // Softer corners for modern, friendly appearance
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Enhanced shadows for better depth perception
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'strong': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        // Smooth animations for senior users
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      screens: {
        // Enhanced breakpoints for Indonesian market (mobile-first)
        'xs': '375px', // Small phones
        'sm': '640px', // Standard phones
        'md': '768px', // Tablets
        'lg': '1024px', // Small desktops
        'xl': '1280px', // Standard desktops
        '2xl': '1536px', // Large desktops
        // Custom breakpoints for accessibility
        'touch': { 'raw': '(hover: none)' },
        'no-touch': { 'raw': '(hover: hover)' },
      },
      zIndex: {
        // Higher z-index values for better layering
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    // Plugin for accessibility
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Focus styles for keyboard navigation
        '.focus-ring': {
          '&:focus': {
            outline: '2px solid var(--tenant-primary)',
            outlineOffset: '2px',
          },
        },
        // High contrast mode support
        '@media (prefers-contrast: high)': {
          '.contrast-high': {
            borderWidth: '2px',
          },
        },
        // Reduced motion support
        '@media (prefers-reduced-motion: reduce)': {
          '.motion-reduce': {
            animation: 'none',
            transition: 'none',
          },
        },
        // Large touch targets for mobile
        '.touch-target': {
          '@media (hover: none)': {
            minHeight: '3rem',
            minWidth: '3rem',
            padding: '1rem',
          },
        },
        // Screen reader only content
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        },
        // Skip to main content link
        '.skip-link': {
          position: 'absolute',
          top: '-40px',
          left: '6px',
          background: 'var(--tenant-primary)',
          color: 'white',
          padding: '8px',
          textDecoration: 'none',
          borderRadius: '4px',
          zIndex: '100',
          '&:focus': {
            top: '6px',
          },
        },
      };
      addUtilities(newUtilities);
    },
    // Plugin for dynamic theming
    function({ addBase, theme }) {
      addBase({
        ':root': {
          '--tenant-primary': '#2563eb',
          '--tenant-secondary': '#64748b',
          '--tenant-accent': '#3b82f6',
          '--tenant-background': '#ffffff',
          '--tenant-surface': '#f8fafc',
          '--tenant-primary-foreground': '#ffffff',
          '--tenant-primary-hover': '#1d4ed8',
          '--tenant-primary-light': '#dbeafe',
          '--tenant-primary-dark': '#1e40af',
          '--tenant-text-primary': '#1f2937',
          '--tenant-text-secondary': '#6b7280',
          '--tenant-border-primary': '#e5e7eb',
          '--tenant-font-heading': '"Inter", system-ui, sans-serif',
          '--tenant-font-body': '"Inter", system-ui, sans-serif',
          '--tenant-font-scale': '1.0',
        },
        // Base styles for accessibility
        'html': {
          scrollBehavior: 'smooth',
        },
        'body': {
          fontFamily: 'var(--tenant-font-body)',
          fontSize: 'calc(16px * var(--tenant-font-scale))',
          lineHeight: '1.6',
          color: 'var(--tenant-text-primary)',
          backgroundColor: 'var(--tenant-background)',
        },
        // Enhanced button styles
        'button': {
          minHeight: '3rem',
          minWidth: '3rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: '600',
          borderRadius: '0.5rem',
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
        // Enhanced input styles
        'input, textarea, select': {
          minHeight: '3rem',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          borderRadius: '0.5rem',
          borderWidth: '2px',
          '&:focus': {
            outline: '2px solid var(--tenant-primary)',
            outlineOffset: '2px',
          },
        },
        // Links with better accessibility
        'a': {
          color: 'var(--tenant-primary)',
          textDecoration: 'underline',
          textDecorationThickness: '2px',
          '&:hover': {
            color: 'var(--tenant-primary-hover)',
          },
          '&:focus': {
            outline: '2px solid var(--tenant-primary)',
            outlineOffset: '2px',
          },
        },
      });
    },
  ],
  darkMode: 'class', // Support for dark mode in future
}