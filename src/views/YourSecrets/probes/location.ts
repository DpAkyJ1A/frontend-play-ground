import type { Probe } from './types';

const location: Probe = {
  id: 'location',
  title: 'Exact location',
  category: 'Location',
  access: 'permission',
  weight: 10,
  permission: 'geolocation',
  compat: ['api.Geolocation.getCurrentPosition'],
  how: 'navigator.geolocation.getCurrentPosition()',
  why: 'GPS or Wi-Fi positioning, often accurate to a few metres. The browser always asks first.',
  action: 'Share location',
  async collect() {
    return {
      lead: null,
      facts: [
        ['Latitude', null],
        ['Longitude', null],
        ['Accuracy', null],
      ],
    };
  },
  async request() {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000,
      })
    );
    const { latitude, longitude, accuracy } = pos.coords;
    return {
      lead: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      facts: [
        ['Latitude', latitude.toFixed(5)],
        ['Longitude', longitude.toFixed(5)],
        ['Accuracy', `${Math.round(accuracy)} m`],
      ],
      link: {
        href: `https://www.openstreetmap.org/?mlat=${latitude.toFixed(5)}&mlon=${longitude.toFixed(5)}#map=17/${latitude.toFixed(5)}/${longitude.toFixed(5)}`,
        label: 'See it on OpenStreetMap',
      },
    };
  },
};

export default location;
