import type { Probe } from './types';
import { hashBytes, nextTask } from './utils';

const SAMPLE = 'Rag Qwj 1@&ß';

const GENERICS: [
  label: string,
  generic: string,
  candidates: [font: string, name?: string][],
][] = [
  [
    'System font',
    'system-ui',
    [
      ['-apple-system', 'San Francisco'],
      ['BlinkMacSystemFont', 'San Francisco'],
      ['Segoe UI Variable Text', 'Segoe UI Variable'],
      ['Segoe UI'],
      ['Roboto'],
      ['Cantarell'],
      ['Ubuntu'],
      ['Noto Sans'],
      ['DejaVu Sans'],
      ['Inter'],
    ],
  ],
  [
    'Serif',
    'serif',
    [
      ['Times'],
      ['Times New Roman'],
      ['Georgia'],
      ['Tinos'],
      ['Liberation Serif'],
      ['DejaVu Serif'],
      ['Noto Serif'],
      ['Cambria'],
    ],
  ],
  [
    'Sans serif',
    'sans-serif',
    [
      ['Helvetica'],
      ['Arial'],
      ['Helvetica Neue'],
      ['Arimo'],
      ['Liberation Sans'],
      ['DejaVu Sans'],
      ['Noto Sans'],
      ['Roboto'],
      ['Segoe UI'],
      ['Verdana'],
    ],
  ],
  [
    'Monospace',
    'monospace',
    [
      ['Courier'],
      ['Courier New'],
      ['Menlo'],
      ['Monaco'],
      ['Consolas'],
      ['Cousine'],
      ['Liberation Mono'],
      ['DejaVu Sans Mono'],
      ['Noto Sans Mono'],
      ['SF Mono'],
    ],
  ],
];

const EMOJI: [font: string, name: string][] = [
  ['Apple Color Emoji', 'Apple'],
  ['Twemoji Mozilla', 'Twemoji, Firefox’s own'],
  ['Segoe UI Emoji', 'Microsoft'],
  ['Noto Color Emoji', 'Google Noto'],
  ['Samsung Color Emoji', 'Samsung'],
];

const EMOJI_RELEASES: [version: string, year: number, sample: string][] = [
  ['17.0', 2025, '\u{1FAEA}'],
  ['16.0', 2024, '\u{1FAE9}'],
  ['15.1', 2023, '\u{1F426}\u200D\u{1F525}'],
  ['15.0', 2022, '\u{1FAE8}'],
  ['14.0', 2021, '\u{1FAE0}'],
  ['13.1', 2020, '\u2764\uFE0F\u200D\u{1F525}'],
  ['13.0', 2020, '\u{1FAC0}'],
  ['12.0', 2019, '\u{1F971}'],
];

const EMOJI_FONTS =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

const newestEmoji = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 40;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `32px ${EMOJI_FONTS}`;
  ctx.textBaseline = 'top';
  const one = ctx.measureText('\u{1F600}').width;
  const drawn = (sample: string) => {
    if (ctx.measureText(sample).width > one * 1.4) return false;
    ctx.clearRect(0, 0, 40, 40);
    ctx.fillStyle = '#000';
    ctx.fillText(sample, 2, 2);
    const px = ctx.getImageData(0, 0, 40, 40).data;
    for (let i = 0; i < px.length; i += 4)
      if (
        px[i + 3] > 100 &&
        (Math.abs(px[i] - px[i + 1]) > 40 ||
          Math.abs(px[i + 1] - px[i + 2]) > 40)
      )
        return true;
    return false;
  };
  const found = EMOJI_RELEASES.find(([, , sample]) => drawn(sample));
  return found
    ? `Emoji ${found[0]}, from ${found[1]}`
    : 'Older than Emoji 12.0';
};

const draw = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 48;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return (font: string, text = SAMPLE) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `32px ${font}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(text, 4, 6);
    return hashBytes(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  };
};

const quote = (font: string) =>
  /^(-apple-system|BlinkMacSystemFont)$/.test(font) ? font : `"${font}"`;

const textSize = () => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:medium;';
  document.body.append(probe);
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return size;
};

const text: Probe = {
  id: 'text',
  title: 'Text rendering',
  category: 'Screen',
  access: 'none',
  weight: 4,
  heavy: true,
  compat: [
    'api.CanvasRenderingContext2D.fillText',
    'api.CanvasRenderingContext2D.getImageData',
  ],
  how: 'Text drawn on a canvas in system-ui, serif, sans-serif and monospace and in named fonts, compared pixel by pixel; digits in each emoji font, the newest emoji of each Emoji release; an element at font-size: medium',
  why: 'Your browser’s default fonts and text size are settings few people change, so those who do stand out. The system font and the emoji set name your OS even when the user agent hides it, and the newest emoji it can draw dates its last update.',
  async collect() {
    const render = draw();
    const facts: [string, string | null][] = [];
    for (const [label, generic, candidates] of GENERICS) {
      const target = render(generic);
      const fallback = generic === 'monospace' ? 'serif' : 'monospace';
      const match = candidates.find(
        ([font]) => render(`${quote(font)}, ${fallback}`) === target
      );
      facts.push([label, match ? (match[1] ?? match[0]) : null]);
      await nextTask();
    }
    const plain = render('monospace', '0123456789#*');
    const emoji = EMOJI.find(
      ([font]) => render(`"${font}", monospace`, '0123456789#*') !== plain
    );
    const size = textSize();
    facts.splice(
      1,
      0,
      ['Emoji', emoji ? emoji[1] : null],
      ['Newest emoji', newestEmoji()]
    );
    facts.push([
      'Text size',
      size
        ? size === 16
          ? '16 px, the default'
          : `${size} px, ${size > 16 ? 'larger' : 'smaller'} than the default`
        : null,
    ]);
    return { lead: facts[0][1], facts };
  },
};

export default text;
