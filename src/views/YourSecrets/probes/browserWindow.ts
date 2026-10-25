import type { Probe } from './types';
import { engineName } from './engine';
import { mq, yesNo } from './utils';

const ZOOMS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
];

let scrollbarWidth: number | null = null;
const scrollbar = () => {
  if (scrollbarWidth !== null) return scrollbarWidth;
  const box = document.createElement('div');
  box.style.cssText =
    'position:absolute;top:-999px;width:100px;height:100px;overflow:scroll;';
  document.body.append(box);
  scrollbarWidth = box.offsetWidth - box.clientWidth;
  box.remove();
  return scrollbarWidth;
};

const BORDERS = [0, 16];

const measure = () => {
  const {
    outerWidth: ow,
    outerHeight: oh,
    innerWidth: iw,
    innerHeight: ih,
  } = window;
  if (!ow || !iw) return null;
  const gecko = engineName() === 'SpiderMonkey';
  let zoom: number | undefined;
  let border = 0;
  for (const b of BORDERS) {
    zoom = ZOOMS.find((z) => Math.abs((ow - b) / iw - z) / z < 0.006);
    if (zoom) {
      border = b;
      break;
    }
  }
  const scale = gecko ? 1 : (zoom ?? 1);
  return {
    zoom: gecko || !zoom ? null : `${Math.round(zoom * 100)}%`,
    bars: Math.max(0, Math.round(oh - border / 2 - ih * scale)),
    side: zoom ? 0 : Math.max(0, Math.round(ow - iw)),
  };
};

const browserWindow: Probe = {
  id: 'browserWindow',
  title: 'Browser window',
  category: 'Screen',
  access: 'none',
  weight: 4,
  live: true,
  compat: [
    'api.Window.screenX',
    'api.Window.outerWidth',
    'api.Document.fullscreenElement',
  ],
  how: 'window.screenX and screenY, outerWidth and outerHeight against innerWidth and innerHeight, and the scrollbar of a scrolling box',
  why: 'Where your window sits, how tall your toolbars are and how far you zoom are your own setup. The scrollbar even shows whether a Mac has a mouse plugged in: with one, macOS keeps scrollbars on screen.',
  async collect() {
    const m = measure();
    const bar = scrollbar();
    const full =
      Boolean(document.fullscreenElement) ||
      mq('(display-mode: fullscreen)') ||
      (window.innerHeight === screen.height &&
        window.innerWidth === screen.width);
    const maximised =
      window.outerWidth >= screen.availWidth - 2 &&
      window.outerHeight >= screen.availHeight - 2;
    return {
      lead: full
        ? 'Full screen'
        : maximised
          ? 'Maximised'
          : `At ${window.screenX}, ${window.screenY} on the screen`,
      facts: [
        [
          'Position',
          `${window.screenX}, ${window.screenY} px from the top left`,
        ],
        ['Window size', `${window.outerWidth} × ${window.outerHeight}`],
        ['Toolbars', m ? (m.bars ? `${m.bars} px tall` : 'None') : null],
        [
          'Side panel or DevTools',
          m ? (m.side > 40 ? `Open, ${m.side} px wide` : 'None open') : null,
        ],
        ['Zoom', m?.zoom ?? null],
        [
          'Scrollbars',
          bar ? `Always shown, ${bar} px` : 'Hidden until you scroll',
        ],
        ['Full screen', yesNo(full)],
        ['Maximised', yesNo(maximised)],
      ],
    };
  },
};

export default browserWindow;
