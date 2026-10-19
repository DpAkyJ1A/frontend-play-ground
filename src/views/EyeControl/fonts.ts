import type { CSSProperties } from 'react';
import { Azeret_Mono, Instrument_Sans } from 'next/font/google';

// Eye Control's faces: a narrow grotesque for headings and an instrument-panel
// mono for the numbers. Turbopack preloads every next/font face on every
// route, so these skip the preload and load with the page that uses them.
// The full stacks keep next/font's metric-matched fallbacks against layout
// shift.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'],
  preload: false,
});

const azeretMono = Azeret_Mono({
  subsets: ['latin'],
  preload: false,
});

export const EYE_FONTS = {
  '--font-display': instrumentSans.style.fontFamily,
  '--font-mono': `${azeretMono.style.fontFamily}, ui-monospace, monospace`,
} as CSSProperties;
