import { Platform } from 'react-native';

// SkinBid's web app (app/globals.css) is dark-only, no light mode toggle.
// Mirrored here as one fixed palette so the mobile app reads as the same product.
export const Colors = {
  text: '#f5f5f0',
  textSecondary: '#9a9a94',
  background: '#0b0b0c',
  backgroundElement: '#151516',
  backgroundSelected: '#1d1d1f',
  border: '#2a2a2e',
  accent: '#c8f24e',
  accentInk: '#0b0b0c',
  danger: '#ff6b5e',
  success: '#7fe0a8',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

// Soft shadows tinted toward the dark background, not flat gray/black —
// per the mobile-app-ui-design skill's shadow guidance.
export const Shadow = Platform.select({
  ios: {
    card: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    accentGlow: { shadowColor: Colors.accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  },
  default: {
    card: { elevation: 6 },
    accentGlow: { elevation: 4 },
  },
})!;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;

// Bottom padding for scroll content on tab screens, so it never sits under
// the floating glass tab bar (see (tabs)/_layout.tsx).
export const TAB_BAR_CLEARANCE = 24 + 64 + 24;
