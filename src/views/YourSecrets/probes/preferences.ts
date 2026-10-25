import type { Probe } from './types';
import { mq, supports, yesNo } from './utils';

const HUES: [upTo: number, name: string][] = [
  [15, 'Red'],
  [40, 'Orange'],
  [65, 'Yellow'],
  [170, 'Green'],
  [200, 'Teal'],
  [255, 'Blue'],
  [290, 'Purple'],
  [345, 'Pink'],
  [360, 'Red'],
];

const systemColour = (keyword: string) => {
  if (!CSS.supports('color', keyword)) return null;
  const probe = document.createElement('div');
  probe.style.color = keyword;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = (
    value.startsWith('color(')
      ? parts.slice(0, 3).map((p) => p * 255)
      : parts.slice(0, 3)
  ).map(Math.round);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  if (!max || (max - min) / max < 0.15) return `Graphite (${hex})`;
  const d = max - min;
  const hue =
    (max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4) * 60;
  const name = HUES.find(([upTo]) => (hue + 360) % 360 < upTo)![1];
  return `${name} (${hex})`;
};

const preferences: Probe = {
  id: 'preferences',
  title: 'Settings',
  category: 'Screen',
  access: 'none',
  weight: 5,
  compat: [
    'css.at-rules.media.prefers-color-scheme',
    'css.at-rules.media.prefers-reduced-motion',
    'css.at-rules.media.prefers-contrast',
    'css.at-rules.media.prefers-reduced-transparency',
    'css.at-rules.media.forced-colors',
    'css.at-rules.media.inverted-colors',
    'css.types.color.system-color.accentcolor',
  ],
  how: 'matchMedia("(prefers-color-scheme: dark)") and other media queries, and the AccentColor and Highlight keywords on a hidden element',
  why: 'Your system settings, accessibility ones included, are readable by any page through CSS.',
  async collect() {
    return {
      lead: mq('(prefers-color-scheme: dark)') ? 'Dark mode' : 'Light mode',
      facts: [
        ['Reduce motion', yesNo(mq('(prefers-reduced-motion: reduce)'))],
        [
          'Contrast',
          mq('(prefers-contrast: more)')
            ? 'More'
            : mq('(prefers-contrast: less)')
              ? 'Less'
              : 'Default',
        ],
        [
          'Reduce transparency',
          supports('(prefers-reduced-transparency)')
            ? yesNo(mq('(prefers-reduced-transparency: reduce)'))
            : null,
        ],
        ['Forced colours', yesNo(mq('(forced-colors: active)'))],
        ['Accent colour', systemColour('AccentColor')],
        ['Highlight colour', systemColour('Highlight')],
        [
          'Inverted colours',
          supports('(inverted-colors)')
            ? yesNo(mq('(inverted-colors: inverted)'))
            : null,
        ],
      ],
    };
  },
};

export default preferences;
