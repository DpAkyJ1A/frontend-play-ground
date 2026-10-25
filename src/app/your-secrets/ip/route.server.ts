// Where this request's IP address places the visitor, read from the headers
// Vercel adds, and the headers the browser itself sent. Nothing is logged or
// stored, and the answer is never cached.
// Vercel-only: a static export has no server, so next.config.ts leaves this
// file out of that build (see pageExtensions) and the card says so.

const NO_STORE = { 'Cache-Control': 'no-store' };

// Vercel URL-encodes the city name
const decoded = (value: string | null) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// What the browser says about itself with every request. Cookies and anything
// else that could sign someone in are never sent back.
const SENT = [
  'user-agent',
  'accept-language',
  'accept-encoding',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-gpc',
  'dnt',
  'save-data',
  // Vercel's digest of the TLS handshake, where it adds one
  'x-vercel-ja4-digest',
];

export async function GET(request: Request) {
  const headers = request.headers;
  const ip = headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
  const sent = {
    headers: Object.fromEntries(SENT.map((name) => [name, headers.get(name)])),
    ipVersion: ip
      ? ip.includes(':') && !ip.startsWith('::ffff:')
        ? 6
        : 4
      : null,
  };
  const country = headers.get('x-vercel-ip-country');
  if (!country)
    return Response.json({ available: false, ...sent }, { headers: NO_STORE });
  return Response.json(
    {
      available: true,
      ...sent,
      ip,
      city: decoded(headers.get('x-vercel-ip-city')),
      country,
      region: headers.get('x-vercel-ip-country-region'),
      latitude: headers.get('x-vercel-ip-latitude'),
      longitude: headers.get('x-vercel-ip-longitude'),
      timeZone: headers.get('x-vercel-ip-timezone'),
    },
    { headers: NO_STORE }
  );
}
