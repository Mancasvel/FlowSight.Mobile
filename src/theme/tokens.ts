/**
 * FlowSight Design Tokens
 *
 * Mapped from flowsight.site: teal primary, slate type, 56px grid,
 * Manrope + Plus Jakarta Sans, liquid-glass surfaces.
 */

// ─── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Primary — site --primary
  primary: '#00B8A9',
  primaryLight: '#5EEAD4',
  primaryDark: '#0F766E',
  primarySurface: '#ECFEFF',

  // Logo gradient companions
  indigo: '#6366F1',
  indigoDeep: '#4F46E5',
  sky: '#38BDF8',

  // Accent — site chart-2 / sky
  accent: '#38BDF8',
  accentLight: '#7DD3FC',
  accentDark: '#0284C7',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Neutral — slate, matching site foreground
  neutral50: '#F8FAFC',
  neutral100: '#F1F5F9',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',
  neutral950: '#020617',

  category: {
    Analysis: '#00B8A9',
    Writing: '#38BDF8',
    Coding: '#10B981',
    Debugging: '#F59E0B',
    CodeReview: '#6366F1',
    Testing: '#22D3EE',
    Documentation: '#64748B',
    Design: '#EC4899',
    Planning: '#14B8A6',
    Meeting: '#F97316',
    Communication: '#6366F1',
    Research: '#0EA5E9',
    Learning: '#22D3EE',
    DevOps: '#84CC16',
    Database: '#A855F7',
    Sales: '#E11D48',
    Admin: '#78716C',
    Browsing: '#94A3B8',
    Idle: '#CBD5E1',
    Focus: '#00B8A9',
    General: '#64748B',
  },
} as const;

const appColors = [
  '#00B8A9',
  '#6366F1',
  '#F59E0B',
  '#EC4899',
  '#38BDF8',
  '#10B981',
  '#F97316',
  '#A855F7',
  '#0EA5E9',
  '#EF4444',
  '#84CC16',
  '#14B8A6',
] as const;

export function categoryColor(name: string): string {
  const palette = colors.category;
  if (name in palette) return palette[name as keyof typeof palette];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (Math.imul(hash, 31) + name.charCodeAt(i)) | 0;
  }
  return appColors[Math.abs(hash) % appColors.length];
}

// ─── Light Theme ───────────────────────────────────────────────────────────────

export const lightTheme = {
  background: '#FBFCFB',
  surface: '#FFFFFF',
  surfaceSecondary: 'rgba(255, 255, 255, 0.62)',
  surfaceTertiary: 'rgba(0, 184, 169, 0.10)',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: 'rgba(15, 23, 42, 0.06)',
  primary: '#00B8A9',
  primaryText: '#FFFFFF',
  accent: '#38BDF8',
  card: 'rgba(255, 255, 255, 0.07)',
  cardShadow: 'rgba(15, 23, 42, 0.06)',
  glass: 'rgba(255, 255, 255, 0.10)',
  glassStrong: 'rgba(255, 255, 255, 0.18)',
  glassBorder: 'rgba(255, 255, 255, 0.58)',
  glassHighlight: 'rgba(255, 255, 255, 0.70)',
  grid: 'rgba(15, 23, 42, 0.14)',
  overlay: 'rgba(15, 23, 42, 0.4)',
  tabBar: 'rgba(255, 255, 255, 0.08)',
  tabBarBorder: 'rgba(255, 255, 255, 0.48)',
  statusBar: 'dark' as const,
};

// ─── Dark Theme ────────────────────────────────────────────────────────────────

export const darkTheme = {
  background: '#070B0C',
  surface: '#101618',
  surfaceSecondary: 'rgba(255, 255, 255, 0.07)',
  surfaceTertiary: 'rgba(45, 212, 191, 0.12)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: colors.neutral900,
  border: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  primary: '#2DD4BF',
  primaryText: '#042F2E',
  accent: colors.sky,
  card: 'rgba(255, 255, 255, 0.06)',
  cardShadow: 'rgba(0, 0, 0, 0.35)',
  glass: 'rgba(255, 255, 255, 0.07)',
  glassStrong: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassHighlight: 'rgba(255, 255, 255, 0.22)',
  grid: 'rgba(255, 255, 255, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: 'rgba(8, 12, 14, 0.18)',
  tabBarBorder: 'rgba(255, 255, 255, 0.14)',
  statusBar: 'light' as const,
};

export type Theme = typeof lightTheme | typeof darkTheme;

// ─── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

// ─── Border Radius ─────────────────────────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  glass: 26,
  full: 9999,
} as const;

// ─── Typography ────────────────────────────────────────────────────────────────

export const fontFamily = {
  display: 'Manrope_600SemiBold',
  displayBold: 'Manrope_700Bold',
  displayMedium: 'Manrope_500Medium',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemibold: 'PlusJakartaSans_600SemiBold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 32,
  xxxl: 36,
  display: 44,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
} as const;

// ─── Motion ────────────────────────────────────────────────────────────────────

export const duration = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

export const easing = {
  standard: [0.4, 0.0, 0.2, 1],
  decelerate: [0.0, 0.0, 0.2, 1],
  accelerate: [0.4, 0.0, 1, 1],
  spring: { damping: 15, stiffness: 150 },
} as const;

// ─── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
} as const;

export const layout = {
  touchTargetIOS: 44,
  touchTargetAndroid: 48,
  screenPaddingHorizontal: 20,
  screenPaddingVertical: 16,
  cardPadding: 18,
  tabBarHeight: 84,
  headerHeight: 56,
  gridSize: 56,
} as const;
