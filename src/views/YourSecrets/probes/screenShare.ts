import type { Fact, Probe } from './types';
import { untilAsked, withTimeout } from './utils';

const SURFACES: Record<string, string> = {
  monitor: 'Your whole screen',
  window: 'A window',
  browser: 'A browser tab',
};

const THUMB_WIDTH = 240;

const grab = async (stream: MediaStream) => {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    const playing = await withTimeout(
      video.play().then(() => true),
      2000
    );
    if (!playing || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = Math.round(
      (video.videoHeight / video.videoWidth) * THUMB_WIDTH
    );
    canvas
      .getContext('2d')!
      .drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  } finally {
    video.pause();
    video.srcObject = null;
  }
};

const EMPTY: Fact[] = [
  ['What you shared', null],
  ['Size', null],
  ['Frame rate', null],
  ['Its name for it', null],
  ['Your pointer', null],
];

const screenShare: Probe = {
  id: 'screenShare',
  title: 'Your screen',
  category: 'Screen',
  access: 'permission',
  weight: 6,
  compat: [
    'api.MediaDevices.getDisplayMedia',
    'api.MediaStreamTrack.getSettings',
    'api.MediaStreamTrack.label',
  ],
  how: 'navigator.mediaDevices.getDisplayMedia(), then getSettings() and the label of the video track and one frame drawn on a canvas. The stream stops at once.',
  why: 'Everything you share is the page’s to record, not only to show: one frame is enough to read your desktop, your open windows and your notifications.',
  action: 'Share my screen',
  async collect() {
    return untilAsked(
      navigator.mediaDevices?.getDisplayMedia,
      EMPTY,
      'Not on this device'
    );
  },
  async request() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const [track] = stream.getVideoTracks();
    let image: string | null;
    let settings: MediaTrackSettings & {
      displaySurface?: string;
      cursor?: string;
    };
    try {
      image = await grab(stream);
      settings = track.getSettings();
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
    const surface = settings.displaySurface
      ? (SURFACES[settings.displaySurface] ?? settings.displaySurface)
      : null;
    const size =
      settings.width && settings.height
        ? `${settings.width} × ${settings.height}`
        : null;
    return {
      lead: [surface, size].filter(Boolean).join(', ') || 'Shared',
      facts: [
        ['What you shared', surface],
        ['Size', size],
        [
          'Frame rate',
          settings.frameRate
            ? `${Math.round(settings.frameRate)} frames a second`
            : null,
        ],
        ['Its name for it', track.label || null],
        [
          'Your pointer',
          settings.cursor
            ? settings.cursor === 'never'
              ? 'Hidden'
              : 'In the picture'
            : null,
        ],
      ],
      image: image
        ? { src: image, alt: 'One frame of what you shared' }
        : undefined,
    };
  },
};

export default screenShare;
