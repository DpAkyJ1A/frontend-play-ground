import { withBasePath } from '@/lib/site';
import { YOUR_SECRETS_ROUTE } from '@/utils/constants/routes';
import { countryOfZone } from './regions';
import type { Probe, ProbeContext } from './types';
import { sandboxed } from './sandbox';

type Sent = {
  headers?: Record<string, string | null>;
  ipVersion?: 4 | 6 | null;
};

type Answer = Sent &
  (
    | { available: false }
    | {
        available: true;
        ip: string | null;
        city: string | null;
        country: string | null;
        region: string | null;
        latitude: string | null;
        longitude: string | null;
        timeZone: string | null;
      }
  );

const fetchAnswer = async ({
  hasServer,
}: ProbeContext): Promise<Answer | null> => {
  if (!hasServer) return null;
  try {
    const response = await fetch(withBasePath(`${YOUR_SECRETS_ROUTE}/ip`), {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as Answer;
  } catch {
    return null;
  }
};

let asked: { at: number; answer: Promise<Answer | null> } | null = null;

export const askServer = (context: ProbeContext) => {
  if (!asked || performance.now() - asked.at > 5000)
    asked = { at: performance.now(), answer: fetchAnswer(context) };
  return asked.answer;
};

const ask = async (context: ProbeContext): Promise<Answer> =>
  (await askServer(context)) ?? { available: false };

const localAddress = async () => {
  const address = await sandboxed('address');
  if (!address) return null;
  return address.endsWith('.local') ? 'Hidden behind a .local name' : address;
};

const regionName = (country: string | null) => {
  if (!country) return null;
  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country
    );
  } catch {
    return country;
  }
};

const offsetOf = (zone: string) => {
  try {
    return new Intl.DateTimeFormat('en', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    })
      .formatToParts()
      .find((part) => part.type === 'timeZoneName')?.value;
  } catch {
    return zone;
  }
};

const ip: Probe = {
  id: 'ip',
  title: 'Your IP',
  category: 'Network',
  access: 'none',
  weight: 8,
  compat: ['api.RTCPeerConnection', 'api.RTCIceCandidate.address'],
  how: 'Every request carries your IP address. This page asks its own server, which reads where Vercel places it from the request headers. WebRTC with no STUN server, in a sandboxed frame, for the local address.',
  why: 'A site needs no script to see your IP: it comes with every request, and it maps to a city. When its country and your clock’s disagree, you are probably behind a VPN or a proxy.',
  async collect(context) {
    const [answer, local] = await Promise.all([ask(context), localAddress()]);
    if (!answer.available)
      return {
        lead: 'Not available on this host',
        guarded: true,
        facts: [
          ['IP address', null],
          ['Country', null],
          ['Coordinates', null],
          ['IP time zone', null],
          ['Local address', local],
        ],
      };
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zoneCountry = countryOfZone(browserZone);
    const sameClock =
      answer.country && zoneCountry
        ? answer.country === zoneCountry
        : answer.timeZone &&
          offsetOf(answer.timeZone) === offsetOf(browserZone);
    const country = regionName(answer.country);
    return {
      lead: [answer.city, country].filter(Boolean).join(', ') || null,
      facts: [
        ['IP address', answer.ip],
        [
          'Country',
          [country, answer.region].filter(Boolean).join(', ') || null,
        ],
        [
          'Coordinates',
          answer.latitude && answer.longitude
            ? `About ${Number(answer.latitude).toFixed(2)}, ${Number(answer.longitude).toFixed(2)}`
            : null,
        ],
        ['IP time zone', answer.timeZone?.replace(/_/g, ' ') ?? null],
        [
          'Your clock',
          answer.timeZone || (answer.country && zoneCountry)
            ? sameClock
              ? 'Matches the IP'
              : 'Looks like a VPN or proxy'
            : null,
        ],
        ['Local address', local],
      ],
      meta: { city: answer.city, country: answer.country },
    };
  },
};

export default ip;
