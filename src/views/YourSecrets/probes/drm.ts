import type { Probe } from './types';
import { withTimeout } from './utils';

const skipped = () => /Firefox\/|Android|CrOS/.test(navigator.userAgent);

const VIDEO = 'video/mp4; codecs="avc1.640028"';

const access = async (
  keySystem: string,
  robustness = '',
  initDataTypes = ['cenc']
) => {
  try {
    return await withTimeout(
      navigator.requestMediaKeySystemAccess(keySystem, [
        {
          initDataTypes,
          distinctiveIdentifier: 'not-allowed',
          persistentState: 'optional',
          videoCapabilities: [{ contentType: VIDEO, robustness }],
        },
      ]),
      2000
    );
  } catch {
    return null;
  }
};

const strongest = async (
  keySystem: string,
  levels: [robustness: string, label: string][]
) => {
  for (const [robustness, label] of levels) {
    const granted = await access(keySystem, robustness);
    if (granted) return { access: granted, label };
  }
  return null;
};

type Policy = {
  getStatusForPolicy?: (policy: { minHdcpVersion: string }) => Promise<string>;
};

const hdcp = async (granted: MediaKeySystemAccess | null) => {
  if (!granted) return null;
  try {
    const keys = (await withTimeout(granted.createMediaKeys(), 2000)) as
      | (MediaKeys & Policy)
      | null;
    if (!keys?.getStatusForPolicy) return null;
    const status = await withTimeout(
      keys.getStatusForPolicy({ minHdcpVersion: '2.2' }),
      1500
    );
    return status === 'usable'
      ? '2.2 or newer, 4K ready'
      : status
        ? 'Below 2.2'
        : null;
  } catch {
    return null;
  }
};

const drm: Probe = {
  id: 'drm',
  title: 'Protected video',
  category: 'Media',
  access: 'none',
  weight: 4,
  heavy: true,
  compat: [
    'api.Navigator.requestMediaKeySystemAccess',
    'api.MediaKeys.getStatusForPolicy',
  ],
  how: 'navigator.requestMediaKeySystemAccess() for Widevine, PlayReady and FairPlay at each security level, and MediaKeys.getStatusForPolicy() for HDCP',
  why: 'Streaming services pick the picture quality from these answers: hardware-backed DRM gets 4K, software gets 720p. The level depends on your chip, your OS and how your screen is connected.',
  async collect() {
    if (skipped() || !navigator.requestMediaKeySystemAccess)
      return {
        lead: 'Not asked in this browser',
        guarded: true,
        facts: [
          ['Widevine', null],
          ['PlayReady', null],
          ['FairPlay', null],
          ['Screen link (HDCP)', null],
        ],
      };
    const [widevine, playready, fairplay] = await Promise.all([
      strongest('com.widevine.alpha', [
        ['HW_SECURE_ALL', 'Hardware (L1)'],
        ['SW_SECURE_DECODE', 'Software (L3)'],
      ]),
      strongest('com.microsoft.playready.recommendation', [
        ['3000', 'Hardware (SL3000)'],
        ['2000', 'Software (SL2000)'],
      ]),
      access('com.apple.fps', '', ['sinf']).then(
        (a) => a ?? access('com.apple.fps.1_0', '', ['sinf'])
      ),
    ]);
    const best = widevine ?? playready;
    const link = await hdcp(best?.access ?? fairplay);
    const lead = widevine
      ? `Widevine, ${widevine.label.split(' ')[0].toLowerCase()}`
      : playready
        ? `PlayReady, ${playready.label.split(' ')[0].toLowerCase()}`
        : fairplay
          ? 'FairPlay'
          : 'No DRM';
    return {
      lead,
      facts: [
        ['Widevine', widevine?.label ?? 'No'],
        ['PlayReady', playready?.label ?? 'No'],
        ['FairPlay', fairplay ? 'Yes' : 'No'],
        ['Screen link (HDCP)', link],
      ],
    };
  },
};

export default drm;
