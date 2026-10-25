import type { Fact, ProbeResult } from './types';

export const mq = (query: string) => window.matchMedia(query).matches;

export const supports = (query: string) =>
  window.matchMedia(query).media !== 'not all';

export const yesNo = (value: boolean | null | undefined) =>
  value === undefined || value === null ? null : value ? 'Yes' : 'No';

export const bytes = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)} GB`
    : `${Math.max(1, Math.round(n / 1e6))} MB`;

export const fileSize = (n: number) =>
  n < 1e6 ? `${Math.max(1, Math.round(n / 1000))} KB` : bytes(n);

export const duration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export const dateTime = (d: Date | null | undefined) =>
  d && !Number.isNaN(d.getTime())
    ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : null;

export const hex4 = (n: number) => n.toString(16).padStart(4, '0');

export const binaryString = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return text;
};

export const untilAsked = (
  available: unknown,
  facts: Fact[],
  missing = 'Not in this browser'
): ProbeResult =>
  available
    ? { lead: null, facts }
    : { lead: missing, guarded: true, final: true, facts };

const cyrb53 = (length: number, at: (i: number) => number, seed: number) => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < length; i++) {
    const ch = at(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
};

export const hash = (str: string, seed = 0) =>
  cyrb53(str.length, (i) => str.charCodeAt(i), seed);

export const hashBytes = (bytes: Uint8Array | Uint8ClampedArray, seed = 0) =>
  cyrb53(bytes.length, (i) => bytes[i], seed);

export const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

export const nextTask = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export const afterPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0))
  );

export const idle = () =>
  new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window)
      requestIdleCallback(() => resolve(), { timeout: 1500 });
    else setTimeout(resolve, 300);
  });

export const permissionState = async (name: PermissionName) => {
  try {
    const status = await navigator.permissions.query({ name });
    return status.state;
  } catch {
    return null;
  }
};

export const languageNames = (codes: readonly string[]) => {
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'language' });
    return [
      ...new Set(codes.map((code) => names.of(code.split('-')[0]) ?? code)),
    ];
  } catch {
    return [...codes];
  }
};

export const listText = (items: string[]) =>
  items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
