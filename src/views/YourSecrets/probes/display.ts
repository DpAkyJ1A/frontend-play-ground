import type { Probe } from './types';
import { display as screenInfo } from './browser';
import { mq, yesNo } from './utils';

const COMMON_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];

const refreshRate = () =>
  new Promise<number>((resolve) => {
    let frames = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      frames++;
      if (now - start < 600) return requestAnimationFrame(step);
      const fps = ((frames - 1) * 1000) / (now - start);
      resolve(
        COMMON_RATES.reduce((a, b) =>
          Math.abs(b - fps) < Math.abs(a - fps) ? b : a
        )
      );
    };
    requestAnimationFrame(step);
  });

const display: Probe = {
  id: 'display',
  title: 'Screen',
  category: 'Screen',
  access: 'none',
  weight: 7,
  heavy: true,
  compat: [
    'api.Screen',
    'api.Window.devicePixelRatio',
    'api.Screen.orientation',
    'api.Screen.isExtended',
    'css.at-rules.media.color-gamut',
    'css.at-rules.media.dynamic-range',
  ],
  how: 'screen, screen.availWidth / availHeight, screen.orientation, devicePixelRatio, matchMedia(), requestAnimationFrame timing',
  why: 'Screen size and pixel density point to a device model. The refresh rate splits phones and laptops of the same size, and the space the dock or taskbar takes says where you keep it.',
  async collect() {
    const hz = await refreshRate();
    const s = screenInfo();
    const colour = [mq('(color-gamut: p3)') ? 'Wide (P3)' : 'Standard (sRGB)'];
    const taken = [s.width - s.availWidth, s.height - s.availHeight];
    const orientation = s.orientation?.type;
    if (mq('(dynamic-range: high)')) colour.push('HDR');
    return {
      lead: `${s.width} × ${s.height}`,
      facts: [
        ['Pixel ratio', `${+devicePixelRatio.toFixed(2)}×`],
        ['Window', `${innerWidth} × ${innerHeight}`],
        ['Usable area', `${s.availWidth} × ${s.availHeight}`],
        [
          'Dock and bars',
          taken[0] && taken[1]
            ? `${taken[1]} px tall, ${taken[0]} px wide`
            : taken[1]
              ? `${taken[1]} px tall`
              : taken[0]
                ? `${taken[0]} px wide`
                : 'None',
        ],
        [
          'Orientation',
          orientation
            ? orientation.startsWith('portrait')
              ? 'Portrait'
              : 'Landscape'
            : null,
        ],
        ['Refresh rate', hz ? `${hz} Hz` : null],
        ['Colour', colour.join(', ')],
        ['Colour depth', `${s.colorDepth}-bit`],
        ['Second screen', 'isExtended' in s ? yesNo(s.isExtended) : null],
      ],
    };
  },
};

export default display;
