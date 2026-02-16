import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'onboarding-accent': '#6366f1',
        'onboarding-accent-end': '#8b5cf6',
        primary: '#4F46E5',
        secondary: '#7C3AED',
        accent: '#06B6D4',
        surface: '#0F172A',
        card: '#1E293B',
        'card-hover': '#334155',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        border: '#334155',
      },
      fontFamily: {
        display: ['var(--font-sora)', 'sans-serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 10px 15px -3px rgba(79, 70, 229, 0.1)',
        'card-hover': '0 20px 25px -5px rgba(79, 70, 229, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
