import type { Config } from 'tailwindcss';

/**
 * RIPCO UI tokens — verbatim from RIPCO-UI.md §17.9 (v2.0, 2026-07-06).
 * Do not add app-local colors; if a value is missing it belongs in RIPCO-UI first.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#2563eb',
        'brand-blue-hover': '#1d4ed8',
        'brand-blue-light': '#eff6ff',
        'brand-green': '#00c875',
        'brand-red': '#df2f4a',
        'brand-orange': '#fdab3d',
        'brand-purple': '#9d50dd',
        'brand-teal': '#00797c',
        'brand-navy': '#041e42',
        ink: '#323338',
        muted: '#676879',
        faint: '#9b9fb0',
        bg: '#f6f7fb',
        'bg-subtle': '#fafbfc',
        border: '#e6e9ef',
        'border-strong': '#c4c4c4',
      },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
      borderRadius: { card: '12px', button: '6px', badge: '12px' },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      },
      transitionDuration: { DEFAULT: '200ms' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
