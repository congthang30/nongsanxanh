/**
 * Design tokens. Mobile-first, large touch targets.
 */
export const colors = {
  primary: '#1f8a4c',
  primaryDark: '#176b3a',
  primaryLight: '#e6f4ec',
  accent: '#f5a623',
  danger: '#d64545',
  dangerLight: '#fbeaea',
  success: '#1f8a4c',
  warning: '#b76e00',
  warningLight: '#fff4e0',
  text: '#1a1a1a',
  textMuted: '#6b7280',
  textInverse: '#ffffff',
  border: '#e5e7eb',
  background: '#f5f6f8',
  surface: '#ffffff',
  overlay: 'rgba(0,0,0,0.45)',
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
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Chieu cao toi thieu cho nut bam (touch target). */
export const TOUCH_TARGET = 48;
