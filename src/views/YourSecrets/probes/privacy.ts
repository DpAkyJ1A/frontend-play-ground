import type { Probe } from './types';
import { nav } from './browser';
import { sandboxed } from './sandbox';
import { mq, withTimeout } from './utils';

const hiddenBait = (dress: (bait: HTMLElement) => void) =>
  new Promise<boolean>((resolve) => {
    const bait = document.createElement('div');
    dress(bait);
    bait.style.cssText = 'position:absolute;left:-999px;width:1px;height:1px;';
    bait.innerHTML = '&nbsp;';
    document.body.append(bait);
    setTimeout(() => {
      const hidden =
        bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none';
      bait.remove();
      resolve(hidden);
    }, 120);
  });

const adBlocked = () =>
  hiddenBait((bait) => {
    bait.className = 'ad ads adsbox ad-banner doubleclick ad-placement';
  });

const COOKIE_BANNERS = [
  'onetrust-consent-sdk',
  'CybotCookiebotDialog',
  'usercentrics-root',
];

const cookieBannersBlocked = async () =>
  (
    await Promise.all(
      COOKIE_BANNERS.map((id) =>
        hiddenBait((bait) => {
          bait.id = id;
          bait.className = 'cc-window cookie-banner';
        })
      )
    )
  ).some(Boolean);

const privateWindow = async () => {
  if (!nav().userAgentData || !navigator.storage?.estimate) return null;
  const estimate = await withTimeout(navigator.storage.estimate(), 1000);
  if (!estimate?.quota) return null;
  const heap =
    (performance as Performance & { memory?: { jsHeapSizeLimit: number } })
      .memory?.jsHeapSizeLimit ?? 2 ** 30;
  return estimate.quota < heap * 2 ? 'Probably' : 'Probably not';
};

const pdfViewer = async () => {
  const answer = await sandboxed('pdf');
  if (answer !== null) return answer;
  return 'pdfViewerEnabled' in navigator ? navigator.pdfViewerEnabled : null;
};

const privacy: Probe = {
  id: 'privacy',
  title: 'Privacy signals',
  category: 'Privacy',
  access: 'none',
  weight: 4,
  compat: [
    'api.Navigator.doNotTrack',
    'api.Navigator.globalPrivacyControl',
    'api.Navigator.pdfViewerEnabled',
    'css.at-rules.media.display-mode',
  ],
  how: 'navigator.doNotTrack, navigator.globalPrivacyControl, hidden elements dressed as an ad and as cookie banners, the storage quota, navigator.pdfViewerEnabled',
  why: 'Asking not to be tracked is one more thing that makes you stand out. So is an ad blocker. A private window gives itself away by its storage quota.',
  async collect() {
    const [blocked, cookies, incognito, pdf] = await Promise.all([
      adBlocked(),
      cookieBannersBlocked(),
      privateWindow(),
      pdfViewer(),
    ]);
    const dnt = navigator.doNotTrack;
    const gpc = nav().globalPrivacyControl;
    const on = [dnt === '1', gpc === true, blocked, cookies].filter(
      Boolean
    ).length;
    return {
      lead: on
        ? `${on} protection${on > 1 ? 's' : ''} on`
        : 'No protections on',
      facts: [
        ['Ad blocker', blocked ? 'On' : 'Off'],
        ['Cookie banner blocker', cookies ? 'On' : 'Off'],
        [
          'Do Not Track',
          dnt === undefined || dnt === null ? null : dnt === '1' ? 'On' : 'Off',
        ],
        [
          'Global Privacy Control',
          gpc === undefined ? null : gpc ? 'On' : 'Off',
        ],
        [
          'Installed as an app',
          mq('(display-mode: standalone)') ? 'Yes' : 'No',
        ],
        ['Private window', incognito],
        ['PDF viewer', pdf === null ? null : pdf ? 'Built in' : 'Off'],
      ],
    };
  },
};

export default privacy;
