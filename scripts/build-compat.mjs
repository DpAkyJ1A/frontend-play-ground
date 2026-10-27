import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const bcd = require('@mdn/browser-compat-data');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const probes = join(root, 'src', 'views', 'YourSecrets', 'probes');
const target = join(probes, 'compat.json');
const versionsTarget = join(probes, 'versions.json');
const BROWSERS = ['chrome', 'edge', 'firefox', 'safari', 'safari_ios', 'chrome_android'];

const keys = new Set();
for (const file of readdirSync(probes).filter((f) => f.endsWith('.ts'))) {
  const list = readFileSync(join(probes, file), 'utf8').match(/compat: \[([^\]]*)\]/);
  for (const [, key] of list?.[1].matchAll(/'([^']+)'/g) ?? []) keys.add(key);
}

// api.Navigator.userAgentData → Navigator.userAgentData,
// css.at-rules.media.prefers-contrast → @media (prefers-contrast),
// css.types.color.light-dark → light-dark(), css.selectors.has → :has()
const FUNCTIONAL = ['has', 'is', 'where', 'not', 'nth-child', 'host', 'state'];
const nameOf = (key) => {
  const [kind, group, ...path] = key.split('.');
  if (kind === 'css') {
    if (group === 'at-rules')
      return path[0] === 'media' && path[1] ? `@media (${path[1]})` : `@${path[0]}`;
    if (group === 'selectors')
      return FUNCTIONAL.includes(path[0]) ? `:${path[0]}()` : `:${path[0]}`;
    if (group === 'types') {
      const type = path.at(-1);
      // system colours are keywords: css.types.color.system-color.accentcolor → AccentColor
      if (path[1] === 'system-color') return type.replace(/^accentcolor/, 'AccentColor').replace(/text$/, 'Text');
      return `${type}()`;
    }
    return path.join(': ');
  }
  // http.headers.Accept-Language → Accept-Language
  const parts =
    kind === 'javascript' || kind === 'http'
      ? path
      : kind === 'webassembly'
        ? ['WebAssembly', ...path]
        : [group, ...path];
  const name = parts.join('.');
  return name
    .replace(/\.(\w+)_event$/, ' $1 event')
    .replace(/\.(\w+)_static$/, '.$1()');
};

// the first statement that works without a flag or a prefix, as shipped today
const since = (statements) => {
  const list = [statements ?? []].flat();
  const current = list.find(
    (s) => !s.flags && !s.prefix && !s.alternative_name && !s.version_removed
  );
  const added = current?.version_added;
  if (!added || added === 'preview') return null;
  return added === true ? 'Yes' : String(added);
};

const out = {};
for (const key of [...keys].sort()) {
  const compat = key.split('.').reduce((node, part) => node?.[part], bcd)?.__compat;
  if (!compat) throw new Error(`No bcd entry for ${key}`);
  out[key] = {
    name: nameOf(key),
    support: Object.fromEntries(
      BROWSERS.map((browser) => [browser, since(compat.support[browser])])
    ),
  };
}

writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`compat: ${keys.size} features from bcd ${bcd.__meta.version} → ${target}`);

// The "Browser build" card: when each feature shipped in each engine, and
// the release lists to count back from. Versions only: a stable release, not
// a preview.
const FAMILIES = ['chrome', 'firefox', 'safari'];
const features = {};
const release = readFileSync(join(probes, 'release.ts'), 'utf8');
for (const [, key] of release.matchAll(/\[\s*'((?:javascript|css|api)\.[^']+)',/g)) {
  const compat = key.split('.').reduce((node, part) => node?.[part], bcd)?.__compat;
  if (!compat) throw new Error(`No bcd entry for ${key}`);
  features[key] = {
    name: nameOf(key),
    ...Object.fromEntries(
      FAMILIES.map((family) => {
        const version = since(compat.support[family]);
        return [family, version === 'Yes' ? null : version];
      })
    ),
  };
}

const releases = Object.fromEntries(
  FAMILIES.map((family) => [
    family,
    Object.entries(bcd.browsers[family].releases)
      .filter(([, info]) => ['retired', 'current', 'esr'].includes(info.status))
      .map(([version]) => version)
      .filter((version) => Number.parseFloat(version) >= (family === 'safari' ? 15 : 95))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
  ])
);

const esr = Object.fromEntries(
  FAMILIES.map((family) => [
    family,
    Object.entries(bcd.browsers[family].releases)
      .filter(([, info]) => info.status === 'esr')
      .map(([version]) => version),
  ])
);

writeFileSync(versionsTarget, `${JSON.stringify({ features, releases, esr }, null, 2)}\n`);

console.log(`versions: ${Object.keys(features).length} dated features → ${versionsTarget}`);
