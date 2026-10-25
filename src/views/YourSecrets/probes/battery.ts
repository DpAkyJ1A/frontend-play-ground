import type { Probe, ProbeResult } from './types';
import { nav } from './browser';
import { duration, withTimeout, yesNo } from './utils';

const KEPT_BACK: ProbeResult = {
  lead: null,
  facts: [
    ['Charging', null],
    ['Time left', null],
  ],
};

const battery: Probe = {
  id: 'battery',
  title: 'Battery',
  category: 'Device',
  access: 'none',
  weight: 3,
  compat: ['api.Navigator.getBattery'],
  how: 'navigator.getBattery()',
  why: 'Level and charge time change slowly, so for a few minutes they can tie two visits together. Firefox and Safari dropped this API for that reason.',
  async collect() {
    const getBattery = nav().getBattery;
    if (!getBattery) return KEPT_BACK;
    const b = await withTimeout(getBattery.call(navigator), 1000);
    if (!b) return KEPT_BACK;
    const left = b.charging ? b.chargingTime : b.dischargingTime;
    return {
      lead: `${Math.round(b.level * 100)}%`,
      facts: [
        ['Charging', yesNo(b.charging)],
        [
          'Time left',
          Number.isFinite(left) && left > 0 ? duration(left * 1000) : null,
        ],
      ],
    };
  },
};

export default battery;
