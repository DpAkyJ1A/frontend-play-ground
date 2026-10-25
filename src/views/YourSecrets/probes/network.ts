import type { Probe } from './types';
import { nav } from './browser';
import { yesNo } from './utils';

const network: Probe = {
  id: 'network',
  title: 'Connection',
  category: 'Network',
  access: 'none',
  weight: 4,
  compat: [
    'api.Navigator.connection',
    'api.NetworkInformation.downlink',
    'api.Navigator.onLine',
  ],
  how: 'navigator.connection, navigator.onLine',
  why: 'Speed and latency hint at Wi-Fi or mobile data. Only Chromium browsers share them.',
  async collect() {
    const c = nav().connection;
    return {
      lead: c
        ? `${c.downlink} Mbps, ${c.effectiveType.toUpperCase()}`
        : navigator.onLine
          ? 'Online'
          : 'Offline',
      facts: [
        ['Online', yesNo(navigator.onLine)],
        ['Latency', c ? `${c.rtt} ms` : null],
        ['Data saver', c ? yesNo(c.saveData) : null],
      ],
    };
  },
};

export default network;
