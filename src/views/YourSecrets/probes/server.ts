import type { Fact, Probe } from './types';
import { askServer } from './ip';
import { listText } from './utils';

const ENCODINGS: Record<string, string> = {
  gzip: 'gzip',
  deflate: 'deflate',
  br: 'Brotli',
  zstd: 'Zstandard',
  dcb: 'Brotli with dictionaries',
  dcz: 'Zstandard with dictionaries',
};

const JA4 = 'x-vercel-ja4-digest';

const tokens = (value: string) =>
  value
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);

const languages = (value: string | null) =>
  value ? listText(tokens(value)) : null;

const encodings = (value: string | null) =>
  value ? listText(tokens(value).map((name) => ENCODINGS[name] ?? name)) : null;

const hints = (brands: string | null, platform: string | null) => {
  if (!brands) return null;
  const list = [...brands.matchAll(/"([^"]+)";v="([^"]+)"/g)]
    .map(([, brand, version]) => ({ brand, version }))
    .filter(({ brand }) => !/Not.?A.?Brand/i.test(brand));
  const named = list.find(({ brand }) => brand !== 'Chromium') ?? list[0];
  if (!named) return null;
  const os = platform?.replace(/"/g, '');
  return `${named.brand} ${named.version}${os ? ` on ${os}` : ''}`;
};

const EMPTY: Fact[] = [
  ['User agent', null],
  ['Languages', null],
  ['Compression', null],
  ['Client hints', null],
  ['Privacy requests', null],
  ['IP version', null],
];

const server: Probe = {
  id: 'server',
  title: 'What the server sees',
  category: 'Network',
  access: 'none',
  weight: 5,
  compat: [
    'http.headers.User-Agent',
    'http.headers.Accept-Language',
    'http.headers.Accept-Encoding',
    'http.headers.Sec-CH-UA',
    'http.headers.Sec-GPC',
  ],
  how: 'The same request as the IP card: this page’s own server sends back the headers it got, User-Agent, Accept-Language, Accept-Encoding, the Sec-CH-UA client hints, Sec-GPC and DNT. Cookies are never sent back.',
  why: 'A script can be blocked; headers can’t. Every request to every site carries your browser, your languages and, in Chromium, its brand and platform, before any script runs. A user agent that differs from the one scripts read gives away an extension that rewrites it.',
  async collect(context) {
    const answer = await askServer(context);
    if (!answer?.headers)
      return {
        lead: 'Not available on this host',
        guarded: true,
        facts: EMPTY,
      };
    const { headers, ipVersion } = answer;
    const get = (name: string) => headers[name] ?? null;
    const ua = get('user-agent');
    const asks = [
      get('sec-gpc') === '1' && 'Global Privacy Control',
      get('dnt') === '1' && 'Do Not Track',
      get('save-data') === 'on' && 'Save Data',
    ].filter(Boolean) as string[];
    const count = Object.keys(headers).filter(
      (name) => name !== JA4 && get(name) !== null
    ).length;
    const ja4 = get(JA4);
    return {
      lead: `${count} headers about you on every request`,
      facts: [
        [
          'User agent',
          ua === null
            ? null
            : ua === navigator.userAgent
              ? 'The same one scripts read'
              : 'Not the one scripts read: something rewrites it',
        ],
        ['Languages', languages(get('accept-language'))],
        ['Compression', encodings(get('accept-encoding'))],
        [
          'Client hints',
          hints(get('sec-ch-ua'), get('sec-ch-ua-platform')) ?? 'None sent',
        ],
        ['Privacy requests', asks.length ? listText(asks) : 'None'],
        ['IP version', ipVersion ? `IPv${ipVersion}` : null],
        ...(ja4 ? [['TLS fingerprint', ja4.slice(0, 16)] as Fact] : []),
      ],
      raw: Object.entries(headers)
        .filter(([, value]) => value !== null)
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n'),
    };
  },
};

export default server;
