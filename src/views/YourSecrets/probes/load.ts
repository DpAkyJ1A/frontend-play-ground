import type { Probe } from './types';
import { fileSize, withTimeout } from './utils';

const PROTOCOLS: Record<string, string> = {
  h3: 'HTTP/3, over QUIC',
  h2: 'HTTP/2',
  'http/1.1': 'HTTP/1.1',
  'http/1.0': 'HTTP/1.0',
};

const ARRIVED: Record<string, string> = {
  navigate: 'A link or the address bar',
  reload: 'A reload',
  back_forward: 'The back or forward button',
  prerender: 'Loaded before you clicked',
};

const span = (from: number, to: number) =>
  to > from ? `${Math.round(to - from)} ms` : null;

const clockOffset = async () => {
  try {
    const sent = Date.now();
    const response = await withTimeout(
      fetch(location.href, { method: 'HEAD', cache: 'no-store' }),
      2000
    );
    const received = Date.now();
    const header = response?.headers.get('date');
    if (!header) return null;
    const server = Date.parse(header) + 500 + (received - sent) / 2;
    const off = (received - server) / 1000;
    if (Math.abs(off) < 2) return 'In sync';
    return `${Math.round(Math.abs(off))} s ${off > 0 ? 'fast' : 'slow'}`;
  } catch {
    return null;
  }
};

const load: Probe = {
  id: 'load',
  title: 'Page load',
  category: 'Network',
  access: 'none',
  weight: 4,
  compat: [
    'api.PerformanceNavigationTiming',
    'api.PerformanceResourceTiming.nextHopProtocol',
    'api.Response.headers',
  ],
  how: 'The Navigation Timing entry of this page: protocol, DNS, connection, TLS, server wait and size. For your clock, the Date header of one more request to this same page.',
  why: 'How the page reached you says something about your network. Office firewalls often block HTTP/3, a DNS lookup of 0 ms means the name was cached because someone on your network asked for it recently, and a clock that’s off makes you stand out.',
  async collect() {
    const entry = performance.getEntriesByType('navigation')[0] as
      | (PerformanceNavigationTiming & { activationStart?: number })
      | undefined;
    const clock = await clockOffset();
    if (!entry)
      return {
        lead: null,
        facts: [
          ['Protocol', null],
          ['DNS lookup', null],
          ['Connecting', null],
          ['Server wait', null],
          ['Downloaded', null],
          ['Arrived by', null],
          ['Your clock', clock],
        ],
      };
    const dns = entry.domainLookupEnd - entry.domainLookupStart;
    const tls =
      entry.secureConnectionStart > 0
        ? span(entry.secureConnectionStart, entry.connectEnd)
        : null;
    const protocol =
      PROTOCOLS[entry.nextHopProtocol] ?? (entry.nextHopProtocol || null);
    const prerendered = (entry.activationStart ?? 0) > 0;
    return {
      lead:
        protocol &&
        `${protocol.split(',')[0]} in ${Math.round(entry.responseEnd)} ms`,
      facts: [
        ['Protocol', protocol],
        [
          'DNS lookup',
          dns > 0
            ? `${Math.round(dns)} ms`
            : entry.connectEnd > 0
              ? 'Cached or reused'
              : null,
        ],
        [
          'Connecting',
          entry.connectEnd > entry.connectStart
            ? `${span(entry.connectStart, entry.connectEnd)}${tls ? `, ${tls} of it TLS` : ''}`
            : 'Reused a connection',
        ],
        ['Server wait', span(entry.requestStart, entry.responseStart)],
        [
          'Downloaded',
          entry.transferSize ? fileSize(entry.transferSize) : 'From the cache',
        ],
        [
          'Arrived by',
          prerendered ? ARRIVED.prerender : (ARRIVED[entry.type] ?? entry.type),
        ],
        ['Your clock', clock],
      ],
    };
  },
};

export default load;
