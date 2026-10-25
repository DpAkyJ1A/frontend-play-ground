import type { Fact, Probe } from './types';
import { FONT_GROUPS, SOFTWARE_GROUPS } from './fonts';
import { hash, untilAsked } from './utils';

type FontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
};

const api = () =>
  (window as unknown as { queryLocalFonts?: () => Promise<FontData[]> })
    .queryLocalFonts;

const APPS: [group: string, pattern: RegExp][] = [
  [
    'Microsoft Office',
    /^(Calibri|Cambria|Candara|Constantia|Corbel|Aptos|Franklin Gothic|Gill Sans MT|Century Gothic|Tw Cen MT)/,
  ],
  [
    'Adobe apps',
    /^(Adobe |Acumin|Myriad|Minion|Kozuka|Birch Std|Brush Script Std|Trajan)/,
  ],
  [
    'Code editors',
    /(JetBrains|Nerd Font|Fira Code|Cascadia|Iosevka|Monaspace|Geist Mono|Hack$)/,
  ],
  [
    'Design kits',
    /^(SF Pro|SF Compact|New York (Small|Medium|Large)|Inter|Montserrat|Poppins|IBM Plex|Manrope|Figtree)/,
  ],
];

const EMPTY: Fact[] = [
  ['Families', null],
  ['Font files', null],
  ['From apps', null],
  ['Font list ID', null],
];

const allFonts: Probe = {
  id: 'allFonts',
  title: 'Every font',
  category: 'Locale',
  access: 'permission',
  weight: 7,
  permission: 'local-fonts' as PermissionName,
  compat: ['api.Window.queryLocalFonts', 'api.FontData'],
  how: 'window.queryLocalFonts(): the family, full name and style of every font file on the system',
  why: 'Made for design tools that need your fonts. The full list is long and personal: every app and every font pack you ever installed adds to it, so it tells you apart almost on its own.',
  action: 'Show every font',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const files = await api()!.call(window);
    if (!files.length) throw new DOMException('No fonts', 'NotAllowedError');
    const families = [...new Set(files.map((f) => f.family))].sort();
    const apps = SOFTWARE_GROUPS.filter((group) =>
      families.some(
        (family) =>
          FONT_GROUPS[group].includes(family) ||
          APPS.some(([name, pattern]) => name === group && pattern.test(family))
      )
    );
    return {
      lead: `${families.length.toLocaleString('en')} font families`,
      facts: [
        ['Families', families.length.toLocaleString('en')],
        ['Font files', files.length.toLocaleString('en')],
        ['From apps', apps.length ? apps.join(', ') : 'None found'],
        [
          'Font list ID',
          families.length ? hash(families.join('\n')).slice(0, 12) : null,
        ],
      ],
      raw: families.join('\n'),
    };
  },
};

export default allFonts;
