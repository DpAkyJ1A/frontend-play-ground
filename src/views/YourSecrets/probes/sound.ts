import type { Fact, Probe } from './types';
import { engineName } from './engine';
import { untilAsked } from './utils';

type Reading = {
  rate: number;
  channels: number;
  base: number;
  output: number;
};

const Context = () =>
  typeof window === 'undefined'
    ? undefined
    : window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

const FRAME = `<script>
(async () => {
  let answer = null;
  try {
    const ctx = new AudioContext();
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    await new Promise((r) => setTimeout(r, 200));
    if (ctx.state === 'running')
      answer = {
        rate: ctx.sampleRate,
        channels: ctx.destination.maxChannelCount,
        base: ctx.baseLatency || 0,
        output: ctx.outputLatency || 0,
      };
    ctx.close();
  } catch {}
  parent.postMessage({ sound: answer }, '*');
})();
<\/script>`;

const inFrame = () =>
  new Promise<Reading | null>((resolve) => {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.allow = 'autoplay *';
    frame.hidden = true;
    frame.srcdoc = FRAME;
    const done = (value: Reading | null) => {
      window.removeEventListener('message', listen);
      clearTimeout(timer);
      frame.remove();
      resolve(value);
    };
    const listen = (e: MessageEvent<{ sound?: Reading | null }>) => {
      if (e.source === frame.contentWindow && e.data && 'sound' in e.data)
        done(e.data.sound ?? null);
    };
    const timer = setTimeout(() => done(null), 3000);
    window.addEventListener('message', listen);
    document.body.append(frame);
  });

const read = async (): Promise<Reading | null> => {
  const ctx = new (Context()!)();
  try {
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 1500))]);
    await new Promise((r) => setTimeout(r, 200));
    if (ctx.state !== 'running') return null;
    return {
      rate: ctx.sampleRate,
      channels: ctx.destination.maxChannelCount,
      base: ctx.baseLatency ?? 0,
      output:
        (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0,
    };
  } catch {
    return null;
  } finally {
    ctx.close();
  }
};

const CHANNELS: Record<number, string> = {
  1: 'mono',
  2: 'stereo',
  6: '5.1 surround',
  8: '7.1 surround',
};

const ms = (seconds: number) =>
  seconds ? `${Math.round(seconds * 1000)} ms` : null;

const EMPTY: Fact[] = [
  ['Sample rate', null],
  ['Channels', null],
  ['Output delay', null],
  ['Processing delay', null],
  ['Wireless headphones', null],
];

const sound: Probe = {
  id: 'sound',
  title: 'Sound output',
  category: 'Media',
  access: 'gesture',
  weight: 3,
  compat: [
    'api.BaseAudioContext.sampleRate',
    'api.AudioDestinationNode.maxChannelCount',
    'api.AudioContext.outputLatency',
  ],
  action: 'Check my sound output',
  note: 'Nothing plays: the page opens your sound output for a moment and closes it.',
  how: 'An AudioContext opened on your click and closed straight away: sampleRate, destination.maxChannelCount, baseLatency and outputLatency',
  why: 'The sample rate and the channels come from your sound settings and hardware: 48 kHz on most laptops, 44.1 kHz on some headphones, six or eight channels on a surround system. A long output delay gives away Bluetooth headphones.',
  async collect() {
    return untilAsked(Context(), EMPTY, 'No sound output');
  },
  async request() {
    const r =
      engineName() === 'V8'
        ? ((await inFrame()) ?? (await read()))
        : await read();
    if (!r)
      return {
        lead: 'No sound output',
        guarded: true,
        facts: EMPTY,
        final: true,
      };
    const channels = CHANNELS[r.channels] ?? `${r.channels} channels`;
    return {
      lead: `${+(r.rate / 1000).toFixed(1)} kHz, ${channels}`,
      facts: [
        ['Sample rate', `${r.rate.toLocaleString('en')} Hz`],
        ['Channels', `${r.channels} (${channels})`],
        ['Output delay', ms(r.output)],
        ['Processing delay', ms(r.base)],
        [
          'Wireless headphones',
          r.output ? (r.output > 0.1 ? 'Probably' : 'Probably not') : null,
        ],
      ],
    };
  },
};

export default sound;
