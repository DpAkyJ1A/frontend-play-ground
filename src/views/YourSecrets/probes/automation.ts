import type { Probe } from './types';
import { nav } from './browser';
import { sandboxed } from './sandbox';
import { yesNo } from './utils';

const input = {
  moves: 0,
  keys: 0,
  turns: 0,
  last: null as { dx: number; dy: number } | null,
};

const onMove = (e: PointerEvent) => {
  if (!e.isTrusted) return;
  input.moves++;
  const step = { dx: Math.sign(e.movementX), dy: Math.sign(e.movementY) };
  const last = input.last;
  if (last && (step.dx !== last.dx || step.dy !== last.dy)) input.turns++;
  input.last = step;
};

const onKey = (e: KeyboardEvent) => {
  if (e.isTrusted) input.keys++;
};

const OPTIONS = { passive: true, capture: true };

const automation: Probe = {
  id: 'automation',
  title: 'Robot or person',
  category: 'Browser',
  access: 'none',
  weight: 4,
  live: true,
  compat: [
    'api.Navigator.webdriver',
    'api.Event.isTrusted',
    'api.Window.outerWidth',
  ],
  how: 'navigator.webdriver, HeadlessChrome in the user agent and brands, the size of the window frame, navigator.languages and plugins, and whether trusted input events arrive and turn',
  why: 'Sites run the same checks to stop scrapers and fraud. Automation tools raise a flag, headless browsers have no window around the page, and people move the mouse in curves, not straight lines.',
  watch() {
    Object.assign(input, { moves: 0, keys: 0, turns: 0, last: null });
    window.addEventListener('pointermove', onMove, OPTIONS);
    window.addEventListener('keydown', onKey, OPTIONS);
    return () => {
      window.removeEventListener('pointermove', onMove, OPTIONS);
      window.removeEventListener('keydown', onKey, OPTIONS);
    };
  },
  async collect() {
    const brands = nav().userAgentData?.brands ?? [];
    const headless =
      /HeadlessChrome/.test(navigator.userAgent) ||
      brands.some((b) => /Headless/i.test(b.brand)) ||
      (window.outerWidth === 0 && window.outerHeight === 0);
    const chromium = /Chrome\//.test(navigator.userAgent);
    const plugins = (await sandboxed('plugins')) ?? navigator.plugins.length;
    const noPlugins = chromium && plugins === 0;
    const noLanguages =
      !navigator.languages || navigator.languages.length === 0;
    const human = input.moves > 20 && input.turns > 3;
    const tells = [
      navigator.webdriver,
      headless,
      noPlugins,
      noLanguages,
    ].filter(Boolean).length;
    return {
      lead: tells
        ? 'Looks automated'
        : human || input.keys > 3
          ? 'Looks like a person'
          : 'Move the mouse to decide',
      facts: [
        ['Driven by a script', yesNo(navigator.webdriver)],
        ['Headless', yesNo(headless)],
        ['Plugins', noPlugins ? 'None, unusual for Chrome' : `${plugins}`],
        [
          'Languages',
          noLanguages ? 'None, unusual' : `${navigator.languages.length}`,
        ],
        [
          'Mouse',
          input.moves
            ? `${input.moves.toLocaleString('en')} moves, ${input.turns.toLocaleString('en')} turns`
            : 'Not moved yet',
        ],
        [
          'Keys',
          input.keys
            ? `${input.keys.toLocaleString('en')} real presses`
            : 'None yet',
        ],
      ],
    };
  },
};

export default automation;
