import type { Probe } from './types';
import { nav } from './browser';
import { languageNames, withTimeout } from './utils';

const timeZoneCity = (tz: string | undefined) =>
  tz ? tz.split('/').pop()!.replace(/_/g, ' ') : null;

const NUMBERING: Record<string, string> = {
  latn: 'Western',
  arab: 'Arabic-Indic',
  arabext: 'Persian',
  beng: 'Bengali',
  deva: 'Devanagari',
  hanidec: 'Chinese',
  mymr: 'Burmese',
  thai: 'Thai',
};

const displayName = (type: Intl.DisplayNamesType, code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type }).of(code) ?? null;
  } catch {
    return null;
  }
};

const digits = (system: string) => {
  try {
    return new Intl.NumberFormat(`en-u-nu-${system}`, {
      useGrouping: false,
    }).format(1234567890);
  } catch {
    return null;
  }
};

const currencyText = (code: string) => {
  const symbol = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value;
  const name = displayName('currency', code) ?? code;
  return symbol && symbol !== code ? `${name} (${symbol})` : name;
};

const whereAndMoney = async (zone: string) => {
  try {
    const { countryOfZone, currencyOf } = await import('./regions');
    const country = countryOfZone(zone);
    const currency = country && currencyOf(country);
    return {
      region: country && displayName('region', country),
      currency: currency ? currencyText(currency) : null,
    };
  } catch {
    return { region: null, currency: null };
  }
};

const keyboardLayout = async () => {
  const keyboard = nav().keyboard;
  if (!keyboard?.getLayoutMap) return null;
  const map = await withTimeout(keyboard.getLayoutMap(), 800);
  if (!map) return null;
  const q = map.get('KeyQ');
  const y = map.get('KeyY');
  if (q && /[а-яёіїєґ]/i.test(q)) return `Cyrillic (${q} on Q)`;
  if (q === 'a') return 'AZERTY';
  if (y === 'z') return 'QWERTZ';
  if (q === 'q') return 'QWERTY';
  return q ? `${q} on Q` : null;
};

const locale: Probe = {
  id: 'locale',
  title: 'Time and language',
  category: 'Locale',
  access: 'none',
  weight: 9,
  compat: [
    'javascript.builtins.Intl.DateTimeFormat.resolvedOptions',
    'api.Navigator.languages',
    'api.Keyboard.getLayoutMap',
    'javascript.builtins.Intl.DisplayNames',
  ],
  how: 'Intl.DateTimeFormat().resolvedOptions(), navigator.languages, navigator.keyboard.getLayoutMap(), a time zone → country table',
  why: 'Your time zone narrows you down to a country, your languages to the people who read them. The keyboard layout gives away what you type in, the calendar and digits where you learned to write.',
  async collect() {
    const options = Intl.DateTimeFormat().resolvedOptions();
    const offset = -new Date().getTimezoneOffset();
    const abs = Math.abs(offset);
    const utc = `UTC${offset >= 0 ? '+' : '−'}${Math.floor(abs / 60)}${
      abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''
    }`;
    const cycle = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
    }).resolvedOptions().hourCycle;
    const [keyboard, place] = await Promise.all([
      keyboardLayout(),
      whereAndMoney(options.timeZone),
    ]);
    const numbering = options.numberingSystem;
    const calendar = displayName('calendar', options.calendar);
    const languages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    const names = languageNames(languages);
    return {
      lead: options.timeZone.replace(/_/g, ' '),
      facts: [
        [
          'Local time',
          `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${utc}`,
        ],
        ['Languages', names.join(', ')],
        ['Date format', new Date(2026, 9, 26).toLocaleDateString()],
        ['Number format', (1234567.89).toLocaleString()],
        [
          'Clock',
          cycle ? (/h2[34]/.test(cycle) ? '24-hour' : '12-hour') : null,
        ],
        ['Keyboard', keyboard],
        ['Region', place.region],
        ['Currency', place.currency],
        ['Calendar', calendar && calendar.replace(/ Calendar$/, '')],
        [
          'Digits',
          numbering
            ? `${NUMBERING[numbering] ?? numbering} (${digits(numbering)?.slice(0, 3) ?? '…'})`
            : null,
        ],
      ],
      meta: {
        city: timeZoneCity(options.timeZone),
        languages: names,
        codes: languages,
        timeZone: options.timeZone,
      },
    };
  },
};

export default locale;
