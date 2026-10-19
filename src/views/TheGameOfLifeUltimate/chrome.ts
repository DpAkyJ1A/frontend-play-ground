import type { CSSProperties } from 'react';
import { colorPresetsList } from './colorsPresets';

// The page's chrome (header, sidebar, buttons, dialogs) is painted from the
// cell palette, so a custom colour re-tints the whole page, not only the board.

const INK_DARK = '#0b0a10';

const mix = (color: string, toward: string, share: number) =>
  `color-mix(in srgb, ${color} ${share}%, ${toward})`;

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour, 0–1; anything else is 0. */
export function luminance(hex: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return 0;
  const [r, g, b] = match.slice(1).map((part) => channel(parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function chromeStyle(
  alive: string,
  dead: string,
  separator: string
): CSSProperties {
  const preset = colorPresetsList.find(
    (p) =>
      same(p.alive, alive) && same(p.dead, dead) && same(p.separator, separator)
  );
  if (preset?.chrome) return preset.chrome as CSSProperties;

  const light = luminance(dead) > 0.5;
  // lighter on a dark page, darker on a light one
  const lift = light ? '#000' : '#fff';
  const sink = light ? '#fff' : '#000';
  const aliveLuminance = luminance(alive);
  const inkOnAccent =
    contrast(aliveLuminance, 1) >= contrast(aliveLuminance, luminance(INK_DARK))
      ? '#ffffff'
      : INK_DARK;

  return {
    '--ink': light ? mix(dead, '#fff', 86) : mix(dead, '#000', 72),
    '--plate': dead,
    '--plate-raised': mix(dead, alive, 92),
    '--rule': separator,
    '--rule-strong': mix(separator, alive, 72),
    '--bone': light ? '#1d1b18' : '#edeaf6',
    '--haze': light ? '#6f6b64' : '#8d89a3',
    '--accent': alive,
    '--accent-soft': mix(alive, lift, 65),
    '--accent-wash': mix(alive, 'transparent', 14),
    '--accent-ink': inkOnAccent,
    '--accent-hover': mix(alive, lift, 85),
    '--accent-press': mix(alive, sink, 82),
    colorScheme: light ? 'light' : 'dark',
  } as CSSProperties;
}
