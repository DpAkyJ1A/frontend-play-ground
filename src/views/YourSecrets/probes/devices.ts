import type { Probe, ProbeResult } from './types';
import { withTimeout } from './utils';

const KEPT_BACK: ProbeResult = {
  lead: null,
  facts: [
    ['Camera', null],
    ['Microphone', null],
    ['Speakers', null],
  ],
};

const devices: Probe = {
  id: 'devices',
  title: 'Cameras and mics',
  category: 'Device',
  access: 'none',
  weight: 3,
  compat: ['api.MediaDevices.enumerateDevices'],
  how: 'navigator.mediaDevices.enumerateDevices()',
  why: 'Without asking, a page sees which kinds of devices you have. With camera access it also gets their names.',
  async collect() {
    if (!navigator.mediaDevices?.enumerateDevices) return KEPT_BACK;
    const list = await withTimeout(
      navigator.mediaDevices.enumerateDevices(),
      1000
    );
    if (!list) return KEPT_BACK;
    const count = (kind: MediaDeviceKind) =>
      list.filter((d) => d.kind === kind).length;
    const has = (kind: MediaDeviceKind) => (count(kind) ? 'Yes' : 'No');
    const kinds = (
      [
        ['videoinput', 'Camera'],
        ['audioinput', 'mic'],
        ['audiooutput', 'speakers'],
      ] as const
    )
      .filter(([kind]) => count(kind))
      .map(([, name]) => name);
    return {
      lead: kinds.length
        ? kinds.join(', ').replace(/^./, (c) => c.toUpperCase())
        : 'None found',
      facts: [
        ['Camera', has('videoinput')],
        ['Microphone', has('audioinput')],
        ['Speakers', count('audiooutput') ? 'Yes' : null],
      ],
    };
  },
};

export default devices;
