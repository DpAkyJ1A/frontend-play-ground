import type { Fact, Probe } from './types';
import { untilAsked } from './utils';

type EyeDropperClass = new () => { open: () => Promise<{ sRGBHex: string }> };

const api = () =>
  (window as unknown as { EyeDropper?: EyeDropperClass }).EyeDropper;

const NAMES: [name: string, rgb: [number, number, number]][] = [
  ['black', [0, 0, 0]],
  ['white', [255, 255, 255]],
  ['grey', [128, 128, 128]],
  ['light grey', [200, 200, 200]],
  ['dark grey', [64, 64, 64]],
  ['red', [220, 40, 40]],
  ['dark red', [128, 20, 20]],
  ['orange', [245, 140, 30]],
  ['yellow', [250, 220, 50]],
  ['olive', [128, 128, 0]],
  ['green', [50, 170, 70]],
  ['dark green', [20, 90, 40]],
  ['teal', [0, 128, 128]],
  ['cyan', [60, 200, 230]],
  ['light blue', [140, 190, 240]],
  ['blue', [30, 110, 230]],
  ['navy', [20, 30, 100]],
  ['purple', [130, 60, 170]],
  ['pink', [240, 120, 180]],
  ['brown', [120, 75, 40]],
  ['beige', [230, 215, 185]],
];

const nearest = ([r, g, b]: number[]) =>
  NAMES.reduce(
    (best, [name, [nr, ng, nb]]) => {
      const d = 2 * (r - nr) ** 2 + 4 * (g - ng) ** 2 + 3 * (b - nb) ** 2;
      return d < best.d ? { name, d } : best;
    },
    { name: '', d: Infinity }
  ).name;

const EMPTY: Fact[] = [
  ['Colour', null],
  ['Red, green, blue', null],
  ['Close to', null],
];

const eyedropper: Probe = {
  id: 'eyedropper',
  title: 'Colour picker',
  category: 'Screen',
  access: 'gesture',
  weight: 3,
  compat: ['api.EyeDropper', 'api.EyeDropper.open'],
  how: 'new EyeDropper().open(): the colour of one pixel you click, anywhere on your screen',
  why: 'One click and a page reads a pixel outside its own window: from another app, a photo or a document you have open. You choose the pixel, but the page can’t tell what you meant to share.',
  action: 'Pick a colour',
  note: 'Then click anywhere on your screen, even outside the browser. Escape cancels.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const { sRGBHex } = await new (api()!)().open();
    const hex = sRGBHex.toLowerCase();
    const rgb =
      hex
        .match(/[0-9a-f]{2}/g)
        ?.slice(0, 3)
        .map((part) => parseInt(part, 16)) ?? [];
    return {
      lead: hex,
      facts: [
        ['Colour', hex],
        ['Red, green, blue', rgb.length === 3 ? rgb.join(', ') : null],
        ['Close to', rgb.length === 3 ? nearest(rgb) : null],
      ],
      image: /^#[0-9a-f]{6}$/.test(hex)
        ? {
            src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="40"><rect width="240" height="40" fill="${hex}"/></svg>`)}`,
            alt: `A swatch of ${hex}`,
          }
        : undefined,
    };
  },
};

export default eyedropper;
