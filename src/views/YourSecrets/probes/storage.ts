import type { Probe } from './types';
import { nav } from './browser';
import { bytes, withTimeout, yesNo } from './utils';

const storage: Probe = {
  id: 'storage',
  title: 'Storage',
  category: 'Privacy',
  access: 'none',
  weight: 5,
  compat: ['api.StorageManager.estimate', 'api.StorageManager.persisted'],
  how: 'navigator.storage.estimate(), navigator.storage.persisted()',
  why: 'Chrome gives each site up to 60% of the disk, so the quota gives away roughly how big your disk is.',
  async collect() {
    const estimate = navigator.storage?.estimate
      ? await withTimeout(navigator.storage.estimate(), 1000)
      : null;
    const persisted = navigator.storage?.persisted
      ? await withTimeout(navigator.storage.persisted(), 1000)
      : null;
    const chromium = !!nav().userAgentData;
    let local = 'Available';
    try {
      localStorage.setItem('ys', '1');
      localStorage.removeItem('ys');
    } catch {
      local = 'Blocked';
    }
    const quota = estimate?.quota;
    const usage = estimate?.usage;
    return {
      lead:
        quota !== undefined && chromium
          ? `About ${bytes(quota / 0.6)} disk`
          : quota !== undefined
            ? `${bytes(quota)} quota`
            : null,
      facts: [
        ['Site quota', quota !== undefined ? bytes(quota) : null],
        ['Used here', usage !== undefined ? bytes(usage) : null],
        ['Kept on cleanup', yesNo(persisted)],
        ['Cookies', navigator.cookieEnabled ? 'On' : 'Off'],
        ['Local storage', local],
      ],
    };
  },
};

export default storage;
