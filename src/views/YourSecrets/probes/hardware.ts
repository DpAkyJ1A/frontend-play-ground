import type { Probe } from './types';
import { nav } from './browser';
import { mq, yesNo } from './utils';

const hardware: Probe = {
  id: 'hardware',
  title: 'Hardware',
  category: 'Device',
  access: 'none',
  weight: 6,
  compat: [
    'api.Navigator.hardwareConcurrency',
    'api.Navigator.deviceMemory',
    'api.Navigator.maxTouchPoints',
  ],
  how: 'navigator.hardwareConcurrency, navigator.deviceMemory, navigator.maxTouchPoints',
  why: 'CPU threads and memory sort devices into price brackets. Chrome rounds memory down and stops at 8 GB to blur it.',
  async collect() {
    const memory = nav().deviceMemory;
    return {
      lead: navigator.hardwareConcurrency
        ? `${navigator.hardwareConcurrency} CPU threads`
        : null,
      facts: [
        [
          'Memory',
          memory ? (memory >= 8 ? '8 GB or more' : `${memory} GB`) : null,
        ],
        ['Touch points', String(navigator.maxTouchPoints ?? '')],
        [
          'Pointer',
          mq('(pointer: coarse)')
            ? 'Touch'
            : mq('(pointer: fine)')
              ? 'Mouse or trackpad'
              : null,
        ],
        ['Hover', yesNo(mq('(hover: hover)'))],
      ],
    };
  },
};

export default hardware;
