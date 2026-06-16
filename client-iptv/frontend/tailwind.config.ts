import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Tailwind configuration porting the "Cinematic Glassmorphism" design system.
 * Tokens are transcribed verbatim from client-iptv/frontend/DESIGN.md and the
 * reference tailwind.config in mockups/explorar_filtros_de_iptv_desktop_dark/code.html.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn/ui semantic aliases (mapped to CSS vars in globals.css)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: '#131313',
        foreground: '#e5e2e1',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },

        // --- Design system semantic tokens (DESIGN.md) ---
        'inverse-on-surface': '#313030',
        'tertiary-fixed-dim': '#a7c8ff',
        'secondary-fixed-dim': '#c8c6c6',
        outline: '#af8782',
        'on-primary-container': '#fff7f6',
        'on-background': '#e5e2e1',
        'on-secondary-fixed-variant': '#474747',
        'surface-tint': '#ffb4aa',
        'surface-container-highest': '#353534',
        'on-primary-fixed': '#410001',
        'on-tertiary-container': '#f8f9ff',
        'on-error': '#690005',
        'tertiary-container': '#0072d7',
        'primary-fixed-dim': '#ffb4aa',
        'on-surface-variant': '#e9bcb6',
        'on-secondary-container': '#b6b5b4',
        'surface-dim': '#131313',
        tertiary: '#a7c8ff',
        'surface-container-lowest': '#0e0e0e',
        'on-tertiary': '#003061',
        'inverse-surface': '#e5e2e1',
        'surface-bright': '#3a3939',
        'on-primary': '#690003',
        'tertiary-fixed': '#d5e3ff',
        'surface-container': '#201f1f',
        'on-tertiary-fixed-variant': '#004689',
        'secondary-fixed': '#e4e2e1',
        'on-tertiary-fixed': '#001b3c',
        'surface-container-low': '#1c1b1b',
        error: '#ffb4ab',
        'primary-container': '#e50914',
        'on-error-container': '#ffdad6',
        'primary-fixed': '#ffdad5',
        'surface-variant': '#353534',
        'outline-variant': '#5e3f3b',
        'on-primary-fixed-variant': '#930007',
        'inverse-primary': '#c0000c',
        'on-secondary-fixed': '#1b1c1c',
        surface: '#131313',
        secondary: '#c8c6c6',
        'secondary-container': '#474747',
        'on-secondary': '#303030',
        'error-container': '#93000a',
        'surface-container-high': '#2a2a2a',
        'on-surface': '#e5e2e1',
        primary: '#ffb4aa'
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px'
      },
      spacing: {
        unit: '8px',
        gutter: '24px',
        'container-max': '1440px',
        'margin-desktop': '64px',
        'margin-tablet': '32px',
        'margin-mobile': '16px'
      },
      maxWidth: {
        'container-max': '1440px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'display-lg': ['Inter'],
        'display-lg-mobile': ['Inter'],
        'headline-lg': ['Inter'],
        'headline-md': ['Inter'],
        'body-lg': ['Inter'],
        'body-md': ['Inter'],
        'label-md': ['Inter'],
        'label-sm': ['Inter']
      },
      fontSize: {
        'display-lg': [
          '64px',
          { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '800' }
        ],
        'display-lg-mobile': [
          '40px',
          { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }
        ],
        'headline-lg': [
          '32px',
          { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }
        ],
        'headline-md': ['24px', { lineHeight: '1.4', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'label-md': [
          '14px',
          { lineHeight: '1.2', letterSpacing: '0.05em', fontWeight: '600' }
        ],
        'label-sm': ['12px', { lineHeight: '1.2', fontWeight: '500' }]
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        // Subtle left-to-right sheen for skeleton placeholders.
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: [animate]
} satisfies Config
