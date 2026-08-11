import { Platform, type TextStyle } from 'react-native';

export const C = {
  bg: '#0A0A0B',
  hud: '#FFB300',
  hudDim: 'rgba(255,179,0,0.35)',
  white: '#F5F5F2',
  whiteDim: 'rgba(245,245,242,0.55)',
  good: '#5CE08A',
  bad: '#FF6B6B',
  neutral: 'rgba(245,245,242,0.30)',
  hairline: 'rgba(245,245,242,0.16)',
  /** Opaque outline for the HUD panel so it reads over any camera background. */
  panelBorder: '#3A3B3F',
  panel: 'rgba(10,10,11,0.72)',
  sheetBg: '#111113',
  scrim: 'rgba(0,0,0,0.62)',
  input: 'rgba(245,245,242,0.06)',
} as const;

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const TYPE = {
  micro: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.whiteDim,
  },
  microBright: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.white,
  },
  label: {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 1,
    color: C.white,
  },
  value: {
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.4,
    color: C.white,
  },
  big: {
    fontFamily: MONO,
    fontSize: 22,
    letterSpacing: 0.4,
    color: C.white,
  },
} satisfies Record<string, TextStyle>;
