import type { Probe } from './types';

const seen = {
  wheels: 0,
  fine: 0,
  gaps: [] as number[],
  capsLock: null as boolean | null,
  repeats: [] as number[],
  lastRepeat: 0,
  firstDelay: 0,
  pressedAt: 0,
  touch: 0,
  tabs: 0,
};

const reset = () =>
  Object.assign(seen, {
    wheels: 0,
    fine: 0,
    gaps: [],
    capsLock: null,
    repeats: [],
    lastRepeat: 0,
    firstDelay: 0,
    pressedAt: 0,
    touch: 0,
    tabs: 0,
  });

const onWheel = (e: WheelEvent) => {
  seen.wheels++;
  const small =
    e.deltaMode === 0 && Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY) < 40;
  const fractional = e.deltaY % 1 !== 0;
  if (small || fractional || (e.deltaX !== 0 && e.deltaY !== 0)) seen.fine++;
};

const onMove = (e: PointerEvent) => {
  if (e.pointerType !== 'mouse' || !e.getCoalescedEvents) return;
  const events = e.getCoalescedEvents();
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timeStamp - events[i - 1].timeStamp;
    if (gap > 0 && gap < 20) seen.gaps.push(gap);
  }
  if (seen.gaps.length > 400) seen.gaps.splice(0, seen.gaps.length - 400);
};

const onDown = (e: PointerEvent) => {
  if (e.pointerType === 'touch' && e.width > 1)
    seen.touch = Math.max(e.width, e.height);
};

const onKey = (e: KeyboardEvent) => {
  if (e.getModifierState) seen.capsLock = e.getModifierState('CapsLock');
  if (e.key === 'Tab' && !e.repeat) seen.tabs++;
  const t = performance.now();
  if (!e.repeat) {
    seen.pressedAt = t;
    seen.lastRepeat = 0;
    return;
  }
  if (!seen.lastRepeat) seen.firstDelay = t - seen.pressedAt;
  else seen.repeats.push(t - seen.lastRepeat);
  seen.lastRepeat = t;
  if (seen.repeats.length > 50) seen.repeats.shift();
};

const median = (list: number[]) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const LISTENERS = [
  ['wheel', onWheel],
  ['pointermove', onMove],
  ['pointerdown', onDown],
  ['keydown', onKey],
] as const;
const OPTIONS = { passive: true, capture: true };

const input: Probe = {
  id: 'input',
  title: 'Mouse and keyboard',
  category: 'Device',
  access: 'none',
  weight: 3,
  live: true,
  compat: [
    'api.PointerEvent.getCoalescedEvents',
    'api.WheelEvent.deltaMode',
    'api.KeyboardEvent.getModifierState',
    'api.KeyboardEvent.repeat',
  ],
  how: 'The step size of wheel events, the timing of getCoalescedEvents() on pointermove, getModifierState("CapsLock"), the repeat flag on a held key, Tab presses and the contact size of a touch',
  why: 'Office mice report 125 times a second and gaming mice 1,000 or more. Trackpads scroll in tiny steps, wheels in clicks. How fast a held key repeats is a setting in your OS. None of it needs a key to be read.',
  watch() {
    reset();
    for (const [type, listener] of LISTENERS)
      window.addEventListener(type, listener as EventListener, OPTIONS);
    return () => {
      for (const [type, listener] of LISTENERS)
        window.removeEventListener(type, listener as EventListener, OPTIONS);
    };
  },
  async collect() {
    const scroller =
      seen.wheels < 5
        ? null
        : seen.fine / seen.wheels > 0.5
          ? 'A trackpad'
          : 'A mouse wheel';
    const rate = seen.gaps.length >= 30 ? 1000 / median(seen.gaps) : null;
    const steps =
      rate &&
      (rate > 200 ? Math.round(rate / 125) * 125 : Math.round(rate / 5) * 5);
    const hz = steps ? `${steps.toLocaleString('en')} times a second` : null;
    const repeat =
      seen.repeats.length >= 3
        ? `Every ${Math.round(median(seen.repeats))} ms after ${Math.round(seen.firstDelay)} ms`
        : null;
    return {
      lead: steps
        ? `Mouse at ${steps.toLocaleString('en')} Hz`
        : (scroller ?? 'Move, scroll or type'),
      facts: [
        ['Scrolling with', scroller ?? 'No scroll yet'],
        ['Mouse reports', hz ?? 'Not moved yet'],
        [
          'Caps Lock',
          seen.capsLock === null
            ? 'No key pressed yet'
            : seen.capsLock
              ? 'On'
              : 'Off',
        ],
        ['Key repeat', repeat ?? 'No key held yet'],
        [
          'Fingertip',
          seen.touch ? `${Math.round(seen.touch)} px wide` : 'No touch yet',
        ],
        [
          'Tab key',
          seen.tabs
            ? `${seen.tabs} ${seen.tabs === 1 ? 'press' : 'presses'}: moving by keyboard`
            : 'Not pressed yet',
        ],
      ],
    };
  },
};

export default input;
