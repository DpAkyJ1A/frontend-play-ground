import type { Fact, Probe } from './types';

const EMPTY: Fact[] = [
  ['Camera', null],
  ['Microphone', null],
  ['Speakers', null],
  ['Camera resolution', null],
  ['How many', null],
];

const ALIASES = ['default', 'communications'];

const resolution = (track: MediaStreamTrack | undefined) => {
  if (!track) return null;
  const caps = track.getCapabilities?.();
  if (caps?.width?.max && caps.height?.max)
    return `Up to ${caps.width.max} × ${caps.height.max}`;
  const { width, height } = track.getSettings();
  return width && height ? `${width} × ${height}` : null;
};

const deviceNames: Probe = {
  id: 'deviceNames',
  title: 'Device names',
  category: 'Device',
  access: 'permission',
  weight: 5,
  permission: 'camera',
  compat: [
    'api.MediaDevices.getUserMedia',
    'api.MediaDeviceInfo.label',
    'api.MediaStreamTrack.getCapabilities',
  ],
  how: 'getUserMedia(), then enumerateDevices() with labels and getCapabilities() of the camera track',
  why: 'Once you let a page use the camera, it can read the names of every camera and microphone, which often include the laptop or headset model.',
  action: 'Allow camera',
  async collect() {
    return { lead: null, facts: EMPTY };
  },
  async request() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    let list: MediaDeviceInfo[];
    let best: string | null = null;
    try {
      list = await navigator.mediaDevices.enumerateDevices();
      best = resolution(stream.getVideoTracks()[0]);
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
    const label = (kind: MediaDeviceKind) =>
      list.find((d) => d.kind === kind && d.label)?.label || null;
    const count = (kind: MediaDeviceKind) =>
      list.filter((d) => d.kind === kind && !ALIASES.includes(d.deviceId))
        .length;
    const cameras = count('videoinput');
    const mics = count('audioinput');
    return {
      lead: label('videoinput'),
      facts: [
        ['Camera', label('videoinput')],
        ['Microphone', label('audioinput')],
        ['Speakers', label('audiooutput')],
        ['Camera resolution', best],
        [
          'How many',
          `${cameras} ${cameras === 1 ? 'camera' : 'cameras'}, ${mics} ${mics === 1 ? 'microphone' : 'microphones'}`,
        ],
      ],
    };
  },
};

export default deviceNames;
