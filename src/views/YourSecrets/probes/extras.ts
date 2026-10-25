import type { Probe } from './types';
import { nav } from './browser';
import { mq, withTimeout, yesNo } from './utils';

type PressureState = 'nominal' | 'fair' | 'serious' | 'critical';
type PressureObserverLike = {
  observe: (
    source: 'cpu',
    options?: { sampleInterval: number }
  ) => Promise<void>;
  disconnect: () => void;
};
type PressureObserverClass = new (
  callback: (records: { state: PressureState }[]) => void
) => PressureObserverLike;

const LOAD: Record<PressureState, string> = {
  nominal: 'Light',
  fair: 'Moderate',
  serious: 'Heavy',
  critical: 'At its limit',
};

let pressure: PressureState | null = null;
let observer: PressureObserverLike | null = null;

const watchPressure = () => {
  const Observer = (
    window as unknown as { PressureObserver?: PressureObserverClass }
  ).PressureObserver;
  if (!Observer) return;
  observer = new Observer((records) => {
    pressure = records[records.length - 1]?.state ?? pressure;
  });
  observer.observe('cpu', { sampleInterval: 1000 }).catch(() => {
    observer = null;
  });
};

let pen = false;
const onPointer = (e: PointerEvent) => {
  if (e.pointerType === 'pen') pen = true;
};

const xr = async (mode: string) => {
  const system = nav().xr;
  if (!system) return null;
  try {
    return await withTimeout(system.isSessionSupported(mode), 1500);
  } catch {
    return null;
  }
};

const foldable = () => {
  if (nav().devicePosture?.type === 'folded' || mq('(device-posture: folded)'))
    return 'Folded now';
  const segments = (window as { viewport?: { segments?: unknown[] | null } })
    .viewport?.segments;
  if (
    (segments?.length ?? 0) > 1 ||
    mq('(horizontal-viewport-segments: 2)') ||
    mq('(vertical-viewport-segments: 2)')
  )
    return 'Open across the fold';
  return null;
};

const leftover = () =>
  window.name ? `“${window.name.slice(0, 40)}”` : 'Nothing';

let checked: Promise<[boolean | null, boolean | null]> | null = null;

const extras: Probe = {
  id: 'extras',
  title: 'Odds and ends',
  category: 'Device',
  access: 'none',
  weight: 2,
  live: true,
  compat: [
    'api.XRSystem.isSessionSupported',
    'api.Navigator.devicePosture',
    'api.Navigator.canShare',
    'api.Window.name',
    'api.Window.opener',
    'api.PressureObserver',
  ],
  how: 'navigator.xr.isSessionSupported(), navigator.devicePosture, navigator.canShare(), pointerType on pointer events, window.opener, window.name and a PressureObserver on the CPU',
  why: 'Small answers that each split people a little further: a VR headset, a pen, a foldable phone. window.name can even carry text left by the last site in this tab.',
  watch() {
    window.addEventListener('pointerdown', onPointer, {
      passive: true,
      capture: true,
    });
    watchPressure();
    return () => {
      window.removeEventListener('pointerdown', onPointer, { capture: true });
      observer?.disconnect();
      observer = null;
      pressure = null;
      pen = false;
    };
  },
  async collect() {
    const [vr, ar] = await (checked ??= Promise.all([
      xr('immersive-vr'),
      xr('immersive-ar'),
    ]));
    const fold = foldable();
    const opened = window.opener !== null;
    let share: boolean | null = null;
    try {
      share = navigator.canShare
        ? navigator.canShare({ text: 'Your Secrets' })
        : false;
    } catch {
      share = null;
    }
    const notable = [
      vr && 'VR headset ready',
      ar && 'AR ready',
      fold && 'Foldable screen',
      pen && 'Pen in use',
      opened && 'Opened from another tab',
      (pressure === 'serious' || pressure === 'critical') &&
        'Processor under heavy load',
    ].filter(Boolean) as string[];
    return {
      lead: notable[0] ?? 'Nothing unusual',
      facts: [
        ['VR headset', yesNo(vr)],
        ['Augmented reality', yesNo(ar)],
        ['Screen fold', fold ?? (nav().devicePosture ? 'None seen' : null)],
        ['Pen', pen ? 'Seen' : 'Not seen'],
        ['Share sheet', yesNo(share)],
        ['Opened from another tab', yesNo(opened)],
        ['Left by the last page', leftover()],
        ['Processor load', pressure ? LOAD[pressure] : null],
      ],
    };
  },
};

export default extras;
