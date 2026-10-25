import type { Probe } from './types';
import { engineName } from './engine';
import { mq, withTimeout } from './utils';

const VIDEO: [label: string, contentType: string][] = [
  ['H.264', 'video/mp4; codecs="avc1.640028"'],
  ['HEVC (H.265)', 'video/mp4; codecs="hvc1.1.6.L120.90"'],
  ['VP9', 'video/webm; codecs="vp09.00.40.08"'],
  ['AV1', 'video/mp4; codecs="av01.0.08M.08"'],
];

const video = (
  contentType: string,
  extra: object = {}
): MediaDecodingConfiguration => ({
  type: 'file',
  video: {
    contentType,
    width: 1920,
    height: 1080,
    bitrate: 5_000_000,
    framerate: 30,
    ...extra,
  },
});

const decode = async (config: MediaDecodingConfiguration) => {
  try {
    return await withTimeout(
      navigator.mediaCapabilities.decodingInfo(config),
      1500
    );
  } catch {
    return null;
  }
};

const verdict = (info: MediaCapabilitiesInfo | null) =>
  !info
    ? null
    : !info.supported
      ? 'No'
      : info.powerEfficient
        ? 'Hardware'
        : 'Software';

const DOLBY = (codec: string): MediaDecodingConfiguration => ({
  type: 'file',
  audio: {
    contentType: `audio/mp4; codecs="${codec}"`,
    channels: '6',
    bitrate: 640_000,
    samplerate: 48_000,
  },
});

const dolbyPlays = async (codec: string) => {
  if (engineName() !== 'SpiderMonkey')
    return (
      document
        .createElement('video')
        .canPlayType(`audio/mp4; codecs="${codec}"`) !== ''
    );
  const info = await decode(DOLBY(codec));
  return info ? info.supported : null;
};

const HDR = video('video/mp4; codecs="hvc1.2.4.L153.B0"', {
  hdrMetadataType: 'smpteSt2086',
  colorGamut: 'rec2020',
  transferFunction: 'pq',
});

const codecs: Probe = {
  id: 'codecs',
  title: 'Video and audio',
  category: 'Media',
  access: 'none',
  weight: 5,
  heavy: true,
  compat: [
    'api.MediaCapabilities.decodingInfo',
    'api.HTMLMediaElement.canPlayType',
  ],
  how: 'navigator.mediaCapabilities.decodingInfo() for 1080p video in each codec and for HDR, matchMedia("(video-dynamic-range: high)"), and decodingInfo() or canPlayType() for Dolby 5.1 audio',
  why: 'Hardware decoders come with particular chips: AV1 in hardware means a graphics chip from 2020 or later. Which codecs play in hardware and which in software dates and sorts your device.',
  async collect() {
    if (!navigator.mediaCapabilities?.decodingInfo)
      return {
        lead: null,
        facts: [
          ...VIDEO.map(([label]): [string, null] => [label, null]),
          ['HDR video', null],
          ['Dolby audio', null],
        ],
      };
    const [results, hdr, plus, digital] = await Promise.all([
      Promise.all(VIDEO.map(([, type]) => decode(video(type)))),
      decode(HDR),
      dolbyPlays('ec-3'),
      dolbyPlays('ac-3'),
    ]);
    const dolby = plus
      ? 'Dolby Digital Plus'
      : digital
        ? 'Dolby Digital'
        : plus === null
          ? null
          : 'No';
    const verdicts = results.map(verdict);
    const hardware = VIDEO.filter((_, i) => verdicts[i] === 'Hardware').map(
      ([label]) => label.replace(/ \(.+\)/, '')
    );
    const screenHdr = mq('(video-dynamic-range: high)');
    return {
      lead: hardware.length
        ? `${hardware.join(', ')} in hardware`
        : verdicts.some((v) => v === 'Software')
          ? 'All in software'
          : null,
      facts: [
        ...VIDEO.map(([label], i): [string, string | null] => [
          label,
          verdicts[i],
        ]),
        [
          'HDR video',
          hdr?.supported
            ? screenHdr
              ? 'Decoder and screen'
              : 'Decoder only, not this screen'
            : screenHdr
              ? 'Screen only'
              : 'No',
        ],
        ['Dolby audio', dolby],
      ],
    };
  },
};

export default codecs;
