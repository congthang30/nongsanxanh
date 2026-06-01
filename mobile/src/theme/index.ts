/**
 * Design tokens. Mobile-first, large touch targets.
 * Bang mau / gradient dong bo voi web customer (frontend/src/styles/index.css).
 */
export const colors = {
  primary: '#16a34a', // green-600 (khop web --primary)
  primaryDark: '#15803d', // green-700
  primaryLight: '#dcfce7', // green-100
  accent: '#f59e0b', // amber-500
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  success: '#16a34a',
  warning: '#b45309', // clay
  warningLight: '#fef3c7',
  text: '#0f1f17', // ink-900
  textMuted: '#586b60', // ink-500
  textInverse: '#ffffff',
  border: '#e6ece8', // line
  background: '#f4f8f5', // bg
  surface: '#ffffff',
  surfaceAlt: '#f7faf8', // surface-2
  overlay: 'rgba(15,31,23,0.5)',
} as const;

/** Bang mau xanh la day du (HSL-tuned) khop --green-* tren web. */
export const green = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
} as const;

/** Diem dau-cuoi gradient (dung voi expo-linear-gradient). */
export const gradients = {
  hero: ['#16a34a', '#15803d', '#166534'] as const,
  leaf: ['#22c55e', '#4ade80'] as const,
  warm: ['#fbbf24', '#f97316'] as const,
  flash: ['#f97316', '#dc2626'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

/** Shadow presets (iOS + Android) khop --shadow-* tren web. */
export const shadow = {
  sm: {
    shadowColor: '#0f1f17',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0f1f17',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#0f1f17',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
} as const;

/** Chieu cao toi thieu cho nut bam (touch target). */
export const TOUCH_TARGET = 48;
