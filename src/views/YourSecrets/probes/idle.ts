import type { Fact, Probe, ProbeResult } from './types';
import { untilAsked } from './utils';

type IdleDetectorLike = EventTarget & {
  userState: 'active' | 'idle' | null;
  screenState: 'locked' | 'unlocked' | null;
  start: (options: { threshold: number; signal: AbortSignal }) => Promise<void>;
};

type IdleDetectorClass = {
  new (): IdleDetectorLike;
  requestPermission: () => Promise<PermissionState>;
};

const api = () =>
  (window as unknown as { IdleDetector?: IdleDetectorClass }).IdleDetector;

const THRESHOLD = 60_000;

let detector: IdleDetectorLike | null = null;
let controller: AbortController | null = null;
const seen = { locks: 0, away: 0, changedAt: 0 };

const onChange = () => {
  if (!detector) return;
  seen.changedAt = Date.now();
  if (detector.screenState === 'locked') seen.locks++;
  if (detector.userState === 'idle') seen.away++;
};

const stop = () => {
  controller?.abort();
  detector?.removeEventListener('change', onChange);
  detector = null;
  controller = null;
  Object.assign(seen, { locks: 0, away: 0, changedAt: 0 });
};

const ago = (at: number) => {
  const s = Math.round((Date.now() - at) / 1000);
  return s < 60 ? `${s} s ago` : `${Math.floor(s / 60)} min ago`;
};

const EMPTY: Fact[] = [
  ['Screen', null],
  ['You', null],
  ['Locked while here', null],
  ['Away while here', null],
  ['Last change', null],
];

const times = (n: number) =>
  n ? `${n} ${n === 1 ? 'time' : 'times'}` : 'Not yet';

const report = (running: IdleDetectorLike): ProbeResult => {
  const locked = running.screenState === 'locked';
  const away = running.userState === 'idle';
  return {
    lead: locked
      ? 'Your screen is locked'
      : away
        ? 'You’re away'
        : 'You’re here, screen unlocked',
    facts: [
      ['Screen', locked ? 'Locked' : 'Unlocked'],
      ['You', away ? 'Away for a minute or more' : 'Active'],
      ['Locked while here', times(seen.locks)],
      ['Away while here', times(seen.away)],
      ['Last change', seen.changedAt ? ago(seen.changedAt) : 'None yet'],
    ],
    final: true,
  };
};

const idle: Probe = {
  id: 'idle',
  title: 'Screen lock',
  category: 'Behaviour',
  access: 'permission',
  weight: 5,
  live: true,
  permission: 'idle-detection' as PermissionName,
  compat: [
    'api.IdleDetector',
    'api.IdleDetector.requestPermission_static',
    'api.IdleDetector.screenState',
  ],
  how: 'IdleDetector.requestPermission(), then an IdleDetector with the shortest threshold, a minute: userState and screenState on every change',
  why: 'Made for chat apps that show you as away. Once allowed, a page in a background tab sees each time you lock the screen or walk away, and when you come back.',
  action: 'Watch my screen lock',
  watch() {
    return stop;
  },
  async collect() {
    return detector ? report(detector) : untilAsked(api(), EMPTY);
  },
  async request() {
    const Detector = api()!;
    if ((await Detector.requestPermission()) !== 'granted')
      throw new DOMException('Idle detection refused', 'NotAllowedError');
    if (!detector) {
      controller = new AbortController();
      detector = new Detector();
      detector.addEventListener('change', onChange);
      try {
        await detector.start({
          threshold: THRESHOLD,
          signal: controller.signal,
        });
      } catch (error) {
        stop();
        throw error;
      }
    }
    return report(detector);
  },
};

export default idle;
