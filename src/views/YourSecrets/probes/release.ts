import type { Probe } from './types';
import { nav } from './browser';
import { engineName } from './engine';
import { parseUA } from './system';
import VERSIONS from './versions.json';

type Family = 'chrome' | 'firefox' | 'safari';

type Versions = {
  features: Record<string, { name: string } & Record<Family, string | null>>;
  releases: Record<Family, string[]>;
};

const DATA = VERSIONS as Versions;

const css = (property: string, value: string) => () =>
  CSS.supports(property, value);
const selector = (s: string) => () => CSS.supports(`selector(${s})`);
const iterator = () =>
  (globalThis as unknown as { Iterator?: { prototype: object } }).Iterator;

const FEATURES: [string, () => boolean][] = [
  ['javascript.builtins.Array.findLast', () => 'findLast' in Array.prototype],
  ['javascript.builtins.Array.toSorted', () => 'toSorted' in Array.prototype],
  [
    'javascript.builtins.String.isWellFormed',
    () => 'isWellFormed' in String.prototype,
  ],
  [
    'javascript.builtins.ArrayBuffer.transfer',
    () => 'transfer' in ArrayBuffer.prototype,
  ],
  ['javascript.builtins.JSON.rawJSON', () => 'rawJSON' in JSON],
  ['javascript.builtins.Object.groupBy', () => 'groupBy' in Object],
  [
    'javascript.builtins.Promise.withResolvers',
    () => 'withResolvers' in Promise,
  ],
  ['javascript.builtins.Array.fromAsync', () => 'fromAsync' in Array],
  ['javascript.builtins.Set.union', () => 'union' in Set.prototype],
  [
    'javascript.builtins.Iterator.map',
    () => Boolean(iterator() && 'map' in iterator()!.prototype),
  ],
  ['javascript.builtins.Promise.try', () => 'try' in Promise],
  ['javascript.builtins.Intl.DurationFormat', () => 'DurationFormat' in Intl],
  [
    'javascript.builtins.Intl.Locale.getWeekInfo',
    () => 'getWeekInfo' in Intl.Locale.prototype,
  ],
  ['javascript.builtins.Atomics.pause', () => 'pause' in Atomics],
  ['javascript.builtins.Error.isError', () => 'isError' in Error],
  [
    'javascript.builtins.DisposableStack',
    () => 'DisposableStack' in globalThis,
  ],
  ['javascript.builtins.Math.f16round', () => 'f16round' in Math],
  ['javascript.builtins.RegExp.escape', () => 'escape' in RegExp],
  [
    'javascript.builtins.Uint8Array.fromBase64',
    () => 'fromBase64' in Uint8Array,
  ],
  ['javascript.builtins.Temporal', () => 'Temporal' in globalThis],
  ['javascript.builtins.Map.getOrInsert', () => 'getOrInsert' in Map.prototype],
  [
    'javascript.builtins.Iterator.concat',
    () => Boolean(iterator() && 'concat' in iterator()!),
  ],
  ['javascript.builtins.Math.sumPrecise', () => 'sumPrecise' in Math],
  [
    'javascript.builtins.Iterator.zip',
    () => Boolean(iterator() && 'zip' in iterator()!),
  ],
  ['css.selectors.has', selector(':has(a)')],
  ['css.selectors.user-valid', selector(':user-valid')],
  ['css.selectors.open', selector(':open')],
  ['css.properties.math-depth', css('math-depth', '1')],
  ['css.properties.view-transition-name', css('view-transition-name', 'a')],
  ['css.properties.text-wrap', css('text-wrap', 'balance')],
  ['css.properties.timeline-scope', css('timeline-scope', '--a')],
  ['css.properties.text-wrap.pretty', css('text-wrap', 'pretty')],
  ['css.at-rules.scope', () => 'CSSScopeRule' in window],
  ['css.properties.scrollbar-color', css('scrollbar-color', 'red blue')],
  ['css.types.color.light-dark', css('color', 'light-dark(#000, #fff)')],
  ['css.properties.field-sizing', css('field-sizing', 'content')],
  ['css.properties.anchor-name', css('anchor-name', '--a')],
  [
    'css.properties.position-try-fallbacks',
    css('position-try-fallbacks', 'flip-block'),
  ],
  [
    'css.properties.interpolate-size',
    css('interpolate-size', 'allow-keywords'),
  ],
  ['css.properties.text-box', css('text-box', 'trim-both cap alphabetic')],
  [
    'css.types.basic-shape.shape',
    css('clip-path', 'shape(from 0 0, line to 10px 10px)'),
  ],
  [
    'css.properties.dynamic-range-limit',
    css('dynamic-range-limit', 'standard'),
  ],
  ['css.properties.reading-flow', css('reading-flow', 'grid-rows')],
  ['css.types.sibling-index', css('order', 'sibling-index()')],
  ['css.types.progress', css('opacity', 'progress(1, 0, 2)')],
  ['css.properties.corner-shape', css('corner-shape', 'squircle')],
  ['css.properties.text-autospace', css('text-autospace', 'normal')],
  ['css.types.color.contrast-color', css('color', 'contrast-color(red)')],
];

const FAMILY: Record<string, Family> = {
  V8: 'chrome',
  SpiderMonkey: 'firefox',
  JavaScriptCore: 'safari',
};

const LABEL: Record<Family, string> = {
  chrome: 'Chromium',
  firefox: 'Firefox',
  safari: 'Safari',
};

const compare = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

const before = (family: Family, version: string) =>
  DATA.releases[family].filter((v) => compare(v, version) < 0).at(-1) ?? null;

const tryFeature = (test: () => boolean) => {
  try {
    return test();
  } catch {
    return false;
  }
};

const maker = () => {
  const ua = navigator.userAgent;
  if ((navigator as Navigator & { brave?: unknown }).brave) return 'Brave';
  if (
    getComputedStyle(document.documentElement).getPropertyValue(
      '--arc-palette-title'
    )
  )
    return 'Arc';
  if ('duckduckgo' in navigator || /Ddg\//.test(ua)) return 'DuckDuckGo';
  if (/YaBrowser\//.test(ua)) return 'Yandex Browser';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Edg(A|iOS)?\//.test(ua)) return 'Microsoft Edge';
  if (/CriOS\//.test(ua)) return 'Chrome on iOS';
  if (/FxiOS\//.test(ua)) return 'Firefox on iOS';
  const brand = nav()
    .userAgentData?.brands?.map((b) => b.brand)
    .find((b) => !/Not.?A.?Brand|Chromium/i.test(b));
  if (brand) return brand;
  if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome or another Chromium browser';
  if (/Safari\//.test(ua)) return 'Apple Safari';
  return null;
};

const claimed = (family: Family) => {
  const ua = navigator.userAgent;
  if (family === 'chrome') {
    const brand = nav().userAgentData?.brands?.find(
      (b) => b.brand === 'Chromium'
    );
    return brand?.version ?? ua.match(/Chrome\/(\d+)/)?.[1] ?? null;
  }
  if (family === 'firefox') return ua.match(/Firefox\/(\d+)/)?.[1] ?? null;
  return ua.match(/Version\/(\d+(?:\.\d+)?)/)?.[1] ?? null;
};

const release: Probe = {
  id: 'release',
  title: 'Browser build',
  category: 'Browser',
  access: 'none',
  weight: 6,
  compat: ['api.CSS.supports_static', 'api.NavigatorUAData.brands'],
  how: `${FEATURES.length} JavaScript and CSS features from the last few years, each checked and dated with MDN's compatibility data, and navigator.userAgentData.brands`,
  why: 'Browsers trim the user agent to hide the exact version, but every release brings new features. Which ones are there dates your browser to within a release or two, and shows when the user agent tells a different story.',
  async collect() {
    const name = engineName();
    const family = name ? FAMILY[name] : undefined;
    const ua = parseUA(navigator.userAgent);
    const says = ua.browser && `${ua.browser} ${ua.version ?? ''}`.trim();
    if (!family)
      return {
        lead: null,
        facts: [
          ['Made by', maker()],
          ['Says it is', says],
          ['Features say', null],
        ],
      };
    const checked = FEATURES.map(([key, test]) => ({
      key,
      has: tryFeature(test),
      since: DATA.features[key]?.[family] ?? null,
    }));
    const dated = checked.filter((f) => f.since);
    const present = dated
      .filter((f) => f.has)
      .sort((a, b) => compare(a.since!, b.since!));
    const missing = dated
      .filter((f) => !f.has)
      .sort((a, b) => compare(a.since!, b.since!));
    const unreleased = checked.filter((f) => f.has && !f.since).length;
    const newest = present.at(-1);
    const low = newest?.since ?? null;
    const firstMissing = missing.find(
      (f) => !low || compare(f.since!, low) > 0
    );
    const high = firstMissing ? before(family, firstMissing.since!) : null;
    const range = low
      ? high && compare(high, low) > 0
        ? `${LABEL[family]} ${low} to ${high}`
        : high && compare(high, low) === 0
          ? `${LABEL[family]} ${low}`
          : `${LABEL[family]} ${low} or newer`
      : null;
    const claim = claimed(family);
    const fits =
      !claim || !low
        ? null
        : compare(claim, low) >= 0 && (!high || compare(claim, high) <= 0)
          ? 'Yes'
          : compare(claim, low) < 0
            ? `No: it says ${claim}, it has newer features`
            : `No: it says ${claim}, it lacks newer features`;
    return {
      lead: range,
      facts: [
        ['Made by', maker()],
        ['Says it is', says],
        ['Features say', range],
        ['Adds up', fits],
        [
          'Newest feature',
          newest
            ? `${DATA.features[newest.key].name}, since ${LABEL[family]} ${newest.since}`
            : null,
        ],
        [
          'Not released yet',
          unreleased ? `${unreleased}: a beta or a nightly build` : 'None',
        ],
        [
          'Checked',
          `${checked.filter((f) => f.has).length} of ${FEATURES.length} present`,
        ],
      ],
      raw: checked
        .map(
          (f) =>
            `${f.has ? '✓' : '·'} ${DATA.features[f.key]?.name ?? f.key} (${f.since ?? 'not released'})`
        )
        .join('\n'),
    };
  },
};

export default release;
