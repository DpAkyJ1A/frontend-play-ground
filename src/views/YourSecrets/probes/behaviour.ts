import type { Probe } from './types';

const counts = {
  lastInput: 0,
  focusLost: 0,
  scrollTop: 0,
  lastScroll: { y: 0, at: 0 },
  keyGaps: [] as number[],
  lastKey: 0,
  path: 0,
  lastPointer: null as { x: number; y: number } | null,
};

const CSS_PX_PER_METRE = 96 / 0.0254;

const now = () => performance.now();

const onInput = () => {
  counts.lastInput = now();
};

const onBlur = () => {
  counts.focusLost++;
};

const onScroll = () => {
  const t = now();
  const y = window.scrollY;
  const { lastScroll } = counts;
  const dt = t - lastScroll.at;
  if (dt > 0 && dt < 200)
    counts.scrollTop = Math.max(
      counts.scrollTop,
      (Math.abs(y - lastScroll.y) / dt) * 1000
    );
  counts.lastScroll = { y, at: t };
  onInput();
};

const onKey = (e: KeyboardEvent) => {
  if (e.repeat) return;
  const t = now();
  if (counts.lastKey && t - counts.lastKey < 2000) {
    counts.keyGaps.push(t - counts.lastKey);
    if (counts.keyGaps.length > 50) counts.keyGaps.shift();
  }
  counts.lastKey = t;
  onInput();
};

const onPointer = (e: PointerEvent) => {
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
    const last = counts.lastPointer;
    if (last) counts.path += Math.hypot(e.clientX - last.x, e.clientY - last.y);
    counts.lastPointer = { x: e.clientX, y: e.clientY };
  }
  onInput();
};

const LISTENERS = [
  ['blur', onBlur],
  ['scroll', onScroll],
  ['keydown', onKey],
  ['pointermove', onPointer],
  ['pointerdown', onInput],
  ['wheel', onInput],
] as const;

const seconds = (ms: number) => `${Math.floor(ms / 1000)} s`;

const behaviour: Probe = {
  id: 'behaviour',
  title: 'How you behave',
  category: 'Behaviour',
  access: 'none',
  weight: 3,
  live: true,
  compat: [
    'api.Window.blur_event',
    'api.Element.keydown_event',
    'api.Element.pointermove_event',
    'api.Document.scroll_event',
  ],
  how: 'blur, scroll, keydown and pointermove events, counted in memory',
  why: 'Without reading a single key, a page can time how you type, how fast you scroll and how much you move the mouse. Rhythms like these are enough to tell people apart.',
  watch() {
    Object.assign(counts, {
      lastInput: now(),
      focusLost: 0,
      scrollTop: 0,
      lastScroll: { y: window.scrollY, at: 0 },
      keyGaps: [],
      lastKey: 0,
      path: 0,
      lastPointer: null,
    });
    const options = { passive: true, capture: true };
    for (const [type, listener] of LISTENERS)
      window.addEventListener(type, listener as EventListener, options);
    return () => {
      for (const [type, listener] of LISTENERS)
        window.removeEventListener(type, listener as EventListener, options);
    };
  },
  async collect() {
    const idle = now() - counts.lastInput;
    const gaps = counts.keyGaps;
    const rhythm = gaps.length
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : null;
    return {
      lead: idle < 2000 ? 'Active right now' : `Idle for ${seconds(idle)}`,
      facts: [
        [
          'Left the window',
          `${counts.focusLost} time${counts.focusLost === 1 ? '' : 's'}`,
        ],
        [
          'Fastest scroll',
          counts.scrollTop
            ? `${Math.round(counts.scrollTop).toLocaleString('en')} px/s`
            : 'No scroll yet',
        ],
        [
          'Typing rhythm',
          rhythm ? `${rhythm} ms between keys` : 'Nothing typed yet',
        ],
        [
          'Mouse travelled',
          counts.path
            ? `${Math.round(counts.path).toLocaleString('en')} px, ${(counts.path / CSS_PX_PER_METRE).toFixed(1)} m`
            : 'Not yet',
        ],
      ],
    };
  },
};

export default behaviour;
