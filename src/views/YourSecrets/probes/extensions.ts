import type { Probe } from './types';
import { listText } from './utils';

const has = (name: string) => name in window;
const el = (selector: string) => () =>
  Boolean(document.querySelector(selector));

const TRACES: Record<string, [string, () => boolean][]> = {
  'Developer tools': [
    ['React DevTools', () => has('__REACT_DEVTOOLS_GLOBAL_HOOK__')],
    ['Redux DevTools', () => has('__REDUX_DEVTOOLS_EXTENSION__')],
    ['Vue DevTools', () => has('__VUE_DEVTOOLS_GLOBAL_HOOK__')],
    ['Apollo DevTools', () => has('__APOLLO_DEVTOOLS_GLOBAL_HOOK__')],
    ['Svelte DevTools', () => has('__svelte_devtools_inject_state')],
  ],
  'Writing help': [
    ['Grammarly', el('grammarly-desktop-integration, [data-gr-ext-installed]')],
    ['LanguageTool', el('lt-toolbar, [data-lt-installed]')],
  ],
  'Password managers': [
    [
      '1Password',
      el(
        'com-1password-button, com-1password-menu, [data-com-onepassword-filled]'
      ),
    ],
    ['LastPass', el('[data-lastpass-root], [data-lastpass-icon-root]')],
    ['Dashlane', el('[data-dashlane-rid]')],
    ['Bitwarden', el('[data-bwautofill]')],
  ],
  'Page changers': [
    [
      'Dark Reader',
      el('meta[name="darkreader"], html[data-darkreader-scheme]'),
    ],
    [
      'Page translation',
      () => /\btranslated-(ltr|rtl)\b/.test(document.documentElement.className),
    ],
    ['Loom', el('#loom-companion-mv3')],
  ],
};

const wallets = new Set<string>();

type Announcement = CustomEvent<{ info?: { name?: string } }>;

const onAnnounce = (e: Event) => {
  const name = (e as Announcement).detail?.info?.name;
  if (name) wallets.add(name);
};

const extensions: Probe = {
  id: 'extensions',
  title: 'Extensions',
  category: 'Browser',
  access: 'none',
  weight: 6,
  live: true,
  compat: ['api.EventTarget.dispatchEvent', 'api.CustomEvent'],
  how: 'Global hooks like __REACT_DEVTOOLS_GLOBAL_HOOK__, the wallet announcements of EIP-6963 (eip6963:requestProvider), and the attributes and elements extensions add to the page',
  why: 'An extension that touches the page leaves marks any script can see. A wallet says you hold crypto, a devtools hook says you build websites, and the mix of them is close to unique.',
  watch() {
    wallets.clear();
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () =>
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
  },
  async collect() {
    const found = Object.fromEntries(
      Object.entries(TRACES).map(([group, list]) => [
        group,
        list.filter(([, seen]) => seen()).map(([name]) => name),
      ])
    );
    const groups: [string, string[]][] = [
      ['Developer tools', found['Developer tools']],
      ['Crypto wallets', [...wallets]],
      ['Writing help', found['Writing help']],
      ['Password managers', found['Password managers']],
      ['Page changers', found['Page changers']],
    ];
    const all = groups.flatMap(([, names]) => names);
    return {
      lead: all.length ? listText(all) : 'None found',
      facts: groups.map(([group, names]) => [
        group,
        names.join(', ') || 'None',
      ]),
    };
  },
};

export default extensions;
