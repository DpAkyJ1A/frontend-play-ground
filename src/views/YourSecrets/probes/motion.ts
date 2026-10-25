import type { Probe, ProbeResult } from './types';

type Reading = {
  beta: number;
  gamma: number;
  alpha: number | null;
  hz: number | null;
};

type WithPermission = { requestPermission?: () => Promise<PermissionState> };
const asksFirst = () =>
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof (DeviceOrientationEvent as unknown as WithPermission)
    .requestPermission === 'function';

const read = () =>
  new Promise<Reading | null>((resolve) => {
    let orientation: DeviceOrientationEvent | null = null;
    let interval: number | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) orientation = e;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      if (e.interval) interval = e.interval;
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    setTimeout(() => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      const o = orientation as DeviceOrientationEvent | null;
      if (!o) return resolve(null);
      resolve({
        beta: o.beta!,
        gamma: o.gamma!,
        alpha: o.alpha,
        hz: interval ? Math.round(1000 / interval) : null,
      });
    }, 800);
  });

const toResult = (reading: Reading | null): ProbeResult =>
  reading
    ? {
        lead: `Tilted ${Math.round(Math.abs(reading.beta))}°`,
        facts: [
          ['Front to back', `${Math.round(reading.beta)}°`],
          ['Side to side', `${Math.round(reading.gamma)}°`],
          [
            'Compass',
            reading.alpha !== null ? `${Math.round(reading.alpha)}°` : null,
          ],
          ['Sensor rate', reading.hz ? `${reading.hz} Hz` : null],
        ],
        final: true,
      }
    : {
        lead: 'No motion sensors',
        guarded: true,
        facts: [
          ['Front to back', null],
          ['Side to side', null],
          ['Compass', null],
          ['Sensor rate', null],
        ],
        final: true,
      };

const motion: Probe = {
  id: 'motion',
  title: 'Tilt and motion',
  category: 'Device',
  access: 'permission',
  weight: 4,
  compat: [
    'api.Window.deviceorientation_event',
    'api.Window.devicemotion_event',
    'api.DeviceOrientationEvent.requestPermission_static',
  ],
  how: 'deviceorientation and devicemotion events; DeviceOrientationEvent.requestPermission() on iOS',
  why: 'How you hold your phone, and how it shakes in your hand, is a signal of its own. Android hands it to any page; iPhones ask first.',
  action: 'Allow motion',
  async collect() {
    if (typeof DeviceOrientationEvent === 'undefined') return toResult(null);
    const reading = await read();
    if (reading || !asksFirst()) return toResult(reading);
    return {
      lead: null,
      facts: [
        ['Front to back', null],
        ['Side to side', null],
        ['Compass', null],
        ['Sensor rate', null],
      ],
    };
  },
  async request() {
    const ask = (DeviceOrientationEvent as unknown as WithPermission)
      .requestPermission;
    if (ask && (await ask()) !== 'granted')
      throw new DOMException('Motion access denied', 'NotAllowedError');
    return toResult(await read());
  },
};

export default motion;
