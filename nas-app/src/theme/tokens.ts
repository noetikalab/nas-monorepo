// Precision design tokens — single source of truth for all colors/spacing/radius
export const c = {
  background: '#FFFFFF',
  foreground: '#1C1C1C',
  primary:   '#2D2D2D',
  muted:     '#F5F5F5',
  mutedForeground: '#838383',
  border:    '#E8E8E8',
  destructive: '#DC2626',
  success:   '#16A34A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
} as const;
