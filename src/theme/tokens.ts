/**
 * FlowSight Design Tokens
 *
 * Preserves the FlowSight identity: violet primary, blue/cyan accent,
 * grey-blue surfaces, soft radii, calm and precise personality.
 */

// ─── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Primary — violet near HSL 263 84% 58%
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  primarySurface: '#EDE9FE',

  // Accent — blue/cyan FlowSight symbol
  accent: '#06B6D4',
  accentLight: '#67E8F9',
  accentDark: '#0891B2',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Neutral — grey-blue tinted
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

  // Category colors (for charts)
  category: {
    Analysis: '#7C3AED',
    Writing: '#3B82F6',
    Coding: '#10B981',
    Debugging: '#F59E0B',
    CodeReview: '#8B5CF6',
    Testing: '#06B6D4',
    Documentation: '#6366F1',
    Design: '#EC4899',
    Planning: '#14B8A6',
    Meeting: '#F97316',
    Communication: '#8B5CF6',
    Research: '#0EA5E9',
    Learning: '#22D3EE',
    DevOps: '#84CC16',
    Database: '#A855F7',
    Sales: '#E11D48',
    Admin: '#78716C',
    Browsing: '#94A3B8',
    Idle: '#CBD5E1',
    General: '#64748B',
  },
} as const;

// ─── Light Theme ───────────────────────────────────────────────────────────────

export const lightTheme = {
  background: colors.neutral50,
  surface: '#FFFFFF',
  surfaceSecondary: colors.neutral100,
  surfaceTertiary: colors.neutral200,
  text: colors.neutral900,
  textSecondary: colors.neutral600,
  textTertiary: colors.neutral400,
  textInverse: '#FFFFFF',
  border: colors.neutral200,
  borderLight: colors.neutral100,
  primary: colors.primary,
  primaryText: '#FFFFFF',
  accent: colors.accent,
  card: '#FFFFFF',
  cardShadow: 'rgba(0, 0, 0, 0.04)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  tabBar: '#FFFFFF',
  tabBarBorder: colors.neutral200,
  statusBar: 'dark' as const,
} as const;

// ─── Dark Theme ────────────────────────────────────────────────────────────────

export const darkTheme = {
  background: colors.neutral950,
  surface: colors.neutral900,
  surfaceSecondary: colors.neutral800,
  surfaceTertiary: colors.neutral700,
  text: colors.neutral50,
  textSecondary: colors.neutral400,
  textTertiary: colors.neutral500,
  textInverse: colors.neutral900,
  border: colors.neutral800,
  borderLight: colors.neutral700,
  primary: colors.primaryLight,
  primaryText: colors.neutral900,
  accent: colors.accentLight,
  card: colors.neutral900,
  cardShadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: colors.neutral900,
  tabBarBorder: colors.neutral800,
  statusBar: 'light' as const,
} as const;

export type Theme = typeof lightTheme;

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
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// ─── Typography ────────────────────────────────────────────────────────────────

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 34,
  display: 40,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// ─── Layout ────────────────────────────────────────────────────────────────────

export const layout = {
  // Minimum touch targets
  touchTargetIOS: 44,
  touchTargetAndroid: 48,
  // Screen padding
  screenPaddingHorizontal: spacing.lg,
  screenPaddingVertical: spacing.xl,
  // Card padding
  cardPadding: spacing.lg,
  // Tab bar height
  tabBarHeight: 84,
  // Header height
  headerHeight: 56,
} as const;
