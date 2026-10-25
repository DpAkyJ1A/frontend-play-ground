import type { Probe } from './types';

export const FONT_GROUPS: Record<string, string[]> = {
  'Microsoft Office': [
    'Calibri',
    'Cambria',
    'Candara',
    'Constantia',
    'Corbel',
    'Aptos',
  ],
  'Adobe apps': [
    'Myriad Pro',
    'Minion Pro',
    'Adobe Garamond Pro',
    'Acumin Pro',
    'Adobe Clean',
  ],
  'Code editors': [
    'JetBrains Mono',
    'Fira Code',
    'Cascadia Code',
    'Source Code Pro',
    'Hack',
    'Iosevka',
  ],
  'Design kits': [
    'Inter',
    'SF Pro Display',
    'Roboto',
    'Montserrat',
    'Poppins',
    'IBM Plex Sans',
    'Manrope',
  ],
  'Apple system': [
    'Helvetica Neue',
    'Avenir Next',
    'Menlo',
    'SF Mono',
    'New York',
  ],
  'Windows system': ['Segoe UI', 'Bahnschrift', 'Consolas'],
  'Linux system': ['Ubuntu', 'DejaVu Sans', 'Cantarell', 'Liberation Sans'],
  'Asian scripts': [
    'PingFang SC',
    'Hiragino Sans',
    'Microsoft YaHei',
    'Malgun Gothic',
  ],
};
export const SOFTWARE_GROUPS = [
  'Microsoft Office',
  'Adobe apps',
  'Code editors',
  'Design kits',
];

const detectFonts = () => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const sample = 'mmmmmmmmmmlli1WQ@#';
  const bases = ['monospace', 'sans-serif', 'serif'];
  const width = (font: string) => {
    ctx.font = `72px ${font}`;
    return ctx.measureText(sample).width;
  };
  const baseWidths = bases.map((base) => width(base));
  const installed = (font: string) =>
    bases.some((base, i) => width(`"${font}", ${base}`) !== baseWidths[i]);
  const found: Record<string, string[]> = {};
  for (const [group, fonts] of Object.entries(FONT_GROUPS)) {
    found[group] = fonts.filter(installed);
  }
  return found;
};

const hidesFonts = () => {
  const ua = navigator.userAgent;
  const safari = ua.match(/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//);
  return Boolean(
    safari && !/Chrome|Chromium|Edg|OPR/.test(ua) && Number(safari[1]) >= 17
  );
};

const fonts: Probe = {
  id: 'fonts',
  title: 'Installed fonts',
  category: 'Locale',
  access: 'none',
  weight: 7,
  heavy: true,
  compat: ['api.CanvasRenderingContext2D.measureText'],
  how: 'Text measured on a canvas in each font against a fallback',
  why: 'Fonts come with apps. Office, Adobe apps and code editors each leave their own. Safari shows pages only the fonts that ship with the system.',
  async collect() {
    const found = detectFonts();
    const all = Object.values(found).flat();
    const total = Object.values(FONT_GROUPS).flat().length;
    const apps = SOFTWARE_GROUPS.filter((group) => found[group].length);
    if (hidesFonts())
      return {
        lead: 'Hidden by your browser',
        guarded: true,
        facts: [
          ['Apps behind them', null],
          ...SOFTWARE_GROUPS.map((group): [string, null] => [group, null]),
        ],
        meta: { fonts: all },
      };
    return {
      lead: `${all.length} of ${total} checked`,
      facts: [
        ['Apps behind them', apps.length ? apps.join(', ') : 'None detected'],
        ...SOFTWARE_GROUPS.map((group): [string, string] => [
          group,
          found[group].join(', ') || 'None',
        ]),
      ],
      meta: { fonts: all },
    };
  },
};

export default fonts;
