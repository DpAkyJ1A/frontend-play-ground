import { countryOfZone } from '../probes/regions';
import type { ProbeResult } from '../probes/types';
import { listText } from '../probes/utils';

export type Level = 'green' | 'yellow' | 'red';

type Dossier = {
  who?: string;
  role?: string;
  where?: string;
  work?: string;
  track?: string;
};

export type Insight = {
  id: string;
  level: Level;
  title: string;
  text: string;
  fix?: string;
  sources: string[];
  plain?: boolean;
  replaces?: string[];
  score?: number;
  dossier?: Dossier;
};

export type Verdict = {
  score: number;
  label: string;
  level: Level;
  text: string;
};

export type Results = ReadonlyMap<string, ProbeResult>;

const NOTHING = new Set(['None', 'None detected', 'None seen', 'No', 'Off']);

const reader = (results: Results) => {
  const get = (id: string) => {
    const result = results.get(id);
    return result && !result.failed ? result : undefined;
  };
  const fact = (id: string, label: string) =>
    get(id)?.facts.find(([name]) => name === label)?.[1] || null;
  const found = (id: string, label: string) => {
    const value = fact(id, label);
    return value && !NOTHING.has(value) ? value : null;
  };
  const lead = (id: string) => {
    const result = get(id);
    return result && !result.guarded ? result.lead : null;
  };
  const number = (id: string, label: string) => {
    const value = Number.parseFloat(fact(id, label)?.replace(/,/g, '') ?? '');
    return Number.isFinite(value) ? value : 0;
  };
  return { fact, found, lead, number, meta: (id: string) => get(id)?.meta };
};

type Read = ReturnType<typeof reader>;
type Rule = (r: Read, crowd: boolean) => Insight | null;
type Clue = [text: string, source: string];

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

const clueText = (clues: Clue[]) => capital(listText(clues.map(([t]) => t)));

const clueSources = (clues: Clue[]) => [...new Set(clues.map(([, s]) => s))];

const article = (noun: string) =>
  /^(?:[aeiou]|nvidia|amd|rtx|m\d|hdr)/i.test(noun) ? 'an' : 'a';

const THE =
  /^(Netherlands|United |Philippines|Bahamas|Gambia|Maldives|Czech Republic|Dominican Republic|Central African|Comoros|Marshall|Solomon|Seychelles)/;

const country = (code: string | null | undefined) => {
  if (!code) return null;
  let name = code;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {}
  return THE.test(name) ? `the ${name}` : name;
};

const GENERIC_NAME =
  /^(admin(istrator)?|user|owner|unknown|guest|root|default|test|author|me|microsoft office user|office user|apple|microsoft|windows user)$/i;

const personName = (value: string | null) => {
  const name = value?.split(', serial')[0].trim();
  if (!name || name.length < 2 || name.length > 40) return null;
  if (
    GENERIC_NAME.test(name) ||
    /@|\d{3}|https?:|\.(com|org|net)\b/i.test(name)
  )
    return null;
  return /\p{L}/u.test(name) ? name : null;
};

const ownerOf = (label: string | null) =>
  personName(label?.match(/^(.{2,30}?)[’']s\s/)?.[1] ?? null);

const GENERIC_COMPANY =
  /^(microsoft|apple|google|home|personal|private|none|n\/a|-)$/i;

const inCrowd = (r: Read) =>
  r.fact('system', 'Engine') === 'Gecko' &&
  /^(Etc\/)?UTC$/.test(r.meta('locale')?.timeZone ?? '') &&
  r.lead('hardware') === '2 CPU threads';

const robot: Rule = (r) => {
  if (r.lead('automation') !== 'Looks automated') return null;
  const tells: Clue[] = [];
  if (r.fact('automation', 'Driven by a script') === 'Yes')
    tells.push(['a script drives this browser', 'automation']);
  if (r.fact('automation', 'Headless') === 'Yes')
    tells.push(['it runs with no window', 'automation']);
  if (r.fact('automation', 'Plugins')?.startsWith('None'))
    tells.push(['it has no plugins', 'automation']);
  if (r.fact('automation', 'Languages')?.startsWith('None'))
    tells.push(['it reports no languages', 'automation']);
  return {
    id: 'robot',
    level: 'green',
    title: 'You’re probably a robot',
    text: `${clueText(tells)}. Bot checks see that before the first click.`,
    sources: ['automation'],
    replaces: ['human'],
    dossier: { who: 'A bot' },
  };
};

const developer: Rule = (r) => {
  const clues: Clue[] = [];
  const tools = r.found('extensions', 'Developer tools');
  if (tools) clues.push([`${tools} in your browser`, 'extensions']);
  const fonts = r.found('fonts', 'Code editors');
  if (fonts) clues.push([`coding fonts (${fonts})`, 'fonts']);
  const looks = r.fact('folder', 'Looks like');
  if (looks && /git|JavaScript|Python/.test(looks))
    clues.push([`${looks.toLowerCase()} in the folder you picked`, 'folder']);
  if (r.fact('serial', 'Port'))
    clues.push(['a board on a serial port', 'serial']);
  if (r.found('release', 'Not released yet'))
    clues.push(['a beta or nightly browser', 'release']);
  if (!clues.length) return null;
  return {
    id: 'developer',
    level: 'green',
    title: 'You write code',
    text: `${clueText(clues)}. Ad networks sell developers as an audience of their own.`,
    sources: clueSources(clues),
    dossier: { role: 'developer' },
  };
};

const gamer: Rule = (r) => {
  const clues: Clue[] = [];
  const pad = r.fact('gamepad', 'Buttons') ? r.lead('gamepad') : null;
  if (pad) clues.push([`${pad} plugged in`, 'gamepad']);
  if (r.fact('hid', 'Kind') === 'A gamepad')
    clues.push([`${r.lead('hid')} connected`, 'hid']);
  const gpu = r.lead('graphics');
  const gaming = gpu && /RTX|GTX|Radeon RX|Arc A\d/i.test(gpu) ? gpu : null;
  const hz = r.number('display', 'Refresh rate');
  const plugged = clues.length > 0;
  if (gaming) clues.push([`${article(gaming)} ${gaming}`, 'graphics']);
  if (hz >= 120 && r.fact('system', 'Mobile') !== 'Yes')
    clues.push([`a ${hz} Hz screen`, 'display']);
  if (!plugged && clues.length < 2) return null;
  return {
    id: 'gamer',
    level: 'green',
    title: 'You play games',
    text: `${clueText(clues)}. Game stores and ad networks price for that.`,
    sources: clueSources(clues),
    dossier: { role: 'gamer' },
  };
};

const creative: Rule = (r) => {
  const clues: Clue[] = [];
  const adobe = r.found('fonts', 'Adobe apps');
  if (adobe) clues.push([`Adobe fonts (${adobe})`, 'fonts']);
  const kits = (r.found('fonts', 'Design kits') ?? '')
    .split(', ')
    .filter((font) => font && font !== 'Roboto');
  if (kits.length >= 3)
    clues.push([
      `design fonts like ${kits.slice(0, 2).join(' and ')}`,
      'fonts',
    ]);
  const design = clues.length > 0;
  const midi = r.lead('midi');
  const music = Boolean(midi && midi !== 'Nothing plugged in');
  if (music) clues.push([`${midi} on MIDI`, 'midi']);
  if (!clues.length) return null;
  return {
    id: 'creative',
    level: 'green',
    title: design
      ? music
        ? 'You design and make music'
        : 'You design things'
      : 'You make music',
    text: `${clueText(clues)}. Creative apps leave traces any site can test for.`,
    sources: clueSources(clues),
    dossier: { role: design ? 'designer' : 'musician' },
  };
};

const office: Rule = (r) => {
  const fonts = r.found('fonts', 'Microsoft Office');
  if (!fonts) return null;
  return {
    id: 'office',
    level: 'green',
    title: 'You have Microsoft Office',
    text: `Its fonts (${fonts}) are on this computer. Sites read them to tell a work machine from a home one.`,
    sources: ['fonts'],
  };
};

const guarded: Rule = (r) => {
  const clues: Clue[] = [];
  const passwords = r.found('extensions', 'Password managers');
  if (passwords) clues.push([`${passwords} for passwords`, 'extensions']);
  if (r.fact('privacy', 'Ad blocker') === 'On')
    clues.push(['an ad blocker', 'privacy']);
  if (r.fact('privacy', 'Cookie banner blocker') === 'On')
    clues.push(['a cookie banner blocker', 'privacy']);
  if (r.fact('privacy', 'Global Privacy Control') === 'On')
    clues.push(['Global Privacy Control', 'privacy']);
  if (!clues.length) return null;
  return {
    id: 'guarded',
    level: 'green',
    title: 'You look after yourself',
    text: `${clueText(clues)}. Good habits, though each one is also a trait that sets you apart.`,
    sources: clueSources(clues),
    score: -4,
  };
};

const blurred: Rule = (r, crowd) =>
  !crowd && r.lead('fingerprint') === 'Scrambled by your browser'
    ? {
        id: 'blurred',
        level: 'green',
        title: 'Your browser blurs your fingerprint',
        text: 'Its drawings change on every run, so the ID at the top won’t follow you from site to site.',
        sources: ['fingerprint'],
        replaces: ['recognised'],
        score: -6,
        dossier: { track: 'with a fingerprint that won’t stick' },
      }
    : null;

const crowded: Rule = (r, crowd) =>
  crowd
    ? {
        id: 'crowd',
        level: 'green',
        title: 'You hide in a crowd',
        text: 'Your clock says UTC and your browser reports two processor threads: that’s how Tor Browser, Mullvad Browser and Firefox’s fingerprint protection make everyone look the same. A site can tell you’re hiding, not who you are.',
        sources: ['locale', 'hardware', 'system'],
        replaces: ['recognised', 'place'],
        score: -8,
        dossier: { track: 'hidden in a crowd of identical browsers' },
      }
    : null;

const night: Rule = (r, crowd) => {
  if (crowd || !r.lead('locale')) return null;
  const now = new Date();
  if (now.getHours() >= 5) return null;
  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    id: 'night',
    level: 'green',
    title: 'You’re up late',
    text: `It’s ${time} where you are. Sites log the hours you’re online, and those sketch your day: when you sleep, when you work.`,
    sources: ['locale'],
  };
};

const recognised: Rule = (r, crowd) => {
  if (crowd || r.lead('fingerprint') !== 'Same on every visit') return null;
  if (!r.fact('fingerprint', 'Canvas')) return null;
  const hidden = r.fact('privacy', 'Private window') === 'Probably';
  return {
    id: 'recognised',
    level: 'yellow',
    title: hidden
      ? 'It knows you, even in a private window'
      : 'It knows you without a cookie',
    text: 'Your canvas, audio and graphics hashes come out the same every time. Clear your cookies or go private: a tracker on another site still gets the same ID, and once you sign in anywhere, that ID has your name.',
    fix: 'Brave, or Firefox with fingerprinting protection, scramble these hashes.',
    sources: hidden ? ['fingerprint', 'privacy'] : ['fingerprint'],
    dossier: { track: 'recognisable on any site without a cookie' },
  };
};

const premium: Rule = (r) => {
  const clues: Clue[] = [];
  const system = r.lead('system') ?? '';
  if (system.startsWith('macOS')) clues.push(['a Mac', 'system']);
  else if (system.startsWith('iPadOS')) clues.push(['an iPad', 'system']);
  else if (system.startsWith('iOS')) clues.push(['an iPhone', 'system']);
  const gpu = r.lead('graphics');
  if (
    gpu &&
    /Apple M\d+ (Pro|Max|Ultra)|RTX ?(40|50)[89]0|RTX ?30[89]0|RX ?7[89]\d0/i.test(
      gpu
    )
  )
    clues.push([`${article(gpu)} ${gpu}`, 'graphics']);
  if (r.fact('display', 'Second screen') === 'Yes')
    clues.push(['a second screen', 'display']);
  else if (r.number('screens', 'How many') >= 2)
    clues.push(['a second screen', 'screens']);
  if (r.fact('display', 'Colour')?.includes('HDR'))
    clues.push(['an HDR screen', 'display']);
  const camera = r.fact('photo', 'Camera');
  if (
    camera &&
    /iPhone \d+ Pro|Pixel \d+ Pro|Galaxy S\d+ Ultra|Galaxy Z/i.test(camera)
  )
    clues.push([`${article(camera)} ${camera}`, 'photo']);
  if (r.fact('passkeys', 'Apple Pay') === 'Ready')
    clues.push(['Apple Pay set up', 'passkeys']);
  if (clues.length < 2) return null;
  return {
    id: 'premium',
    level: 'yellow',
    title: 'Shops would mark you as a big spender',
    text: `${clueText(clues)}. Orbitz once showed Mac users pricier hotels; prices that follow the device still start from signals like these.`,
    fix: 'Check the price on another device before you pay.',
    sources: clueSources(clues),
  };
};

const vpn: Rule = (r, crowd) => {
  const ip = r.meta('ip')?.country;
  const zone = r.meta('locale')?.timeZone;
  const clock = zone ? countryOfZone(zone) : null;
  if (crowd || !ip || !clock || ip === clock) return null;
  return {
    id: 'vpn',
    level: 'yellow',
    title: 'Your VPN gives itself away',
    text: `Your IP says ${country(ip)}, your clock says ${country(clock)}. A VPN that doesn’t move your clock tells every site you’re using one, and where you really are.`,
    fix: 'Set your computer’s time zone to the VPN’s country, or use a browser that reports UTC.',
    sources: ['ip', 'locale'],
    replaces: ['city', 'place'],
    dossier: { where: `in ${country(clock)}, behind a VPN in ${country(ip)}` },
  };
};

const city: Rule = (r, crowd) => {
  const place = r.lead('ip');
  const name = r.meta('ip')?.city;
  if (crowd || !place || !name) return null;
  const near = r.fact('ip', 'Coordinates')?.replace(/^About /, '');
  return {
    id: 'city',
    level: 'yellow',
    title: `It knows your city: ${name}`,
    text: `Your IP points to ${place}${near ? `, around ${near}` : ''}. No permission asked: it comes with every request, to every site.`,
    fix: 'A VPN hides it, as long as your clock moves with it.',
    sources: ['ip'],
    replaces: ['place'],
    dossier: { where: `in ${name}` },
  };
};

const health: Rule = (r) => {
  const clues: Clue[] = [];
  const on = (label: string) => r.fact('preferences', label) === 'Yes';
  if (on('Reduce motion')) clues.push(['reduce motion is on', 'preferences']);
  if (r.fact('preferences', 'Contrast') === 'More')
    clues.push(['contrast is turned up', 'preferences']);
  if (on('Forced colours'))
    clues.push(['forced colours are on', 'preferences']);
  if (on('Inverted colours'))
    clues.push(['colours are inverted', 'preferences']);
  if (on('Reduce transparency'))
    clues.push(['transparency is turned down', 'preferences']);
  const size = r.fact('text', 'Text size');
  if (size?.includes('larger'))
    clues.push([`text is set larger (${size.split(',')[0]})`, 'text']);
  if (!clues.length) return null;
  return {
    id: 'health',
    level: 'yellow',
    title: 'Your settings hint at your health',
    text: `${clueText(clues)}. Any site can read that, and it can point to eyesight, migraines or motion sickness: the kind of thing privacy law treats as health data.`,
    sources: clueSources(clues),
  };
};

const watching: Rule = (r) => {
  const tabs = r.number('visit', 'Looked away');
  const away =
    r.number('idle', 'Away while here') + r.number('idle', 'Locked while here');
  const times = tabs + away;
  if (!times) return null;
  return {
    id: 'watching',
    level: 'yellow',
    title: `It saw you leave, ${times} time${times === 1 ? '' : 's'}`,
    text: 'Every switch to another tab or app, and every return, is timed. Exam, ad and video sites use exactly this to check whether you’re paying attention.',
    sources: [...(tabs ? ['visit'] : []), ...(away ? ['idle'] : [])],
  };
};

const crypto: Rule = (r) => {
  const wallets = r.found('extensions', 'Crypto wallets');
  if (!wallets) return null;
  return {
    id: 'crypto',
    level: 'yellow',
    title: `You hold crypto: ${wallets}`,
    text: 'Wallets announce themselves to any page that asks, and drainer sites ask first. Then comes the fake “Connect wallet” button.',
    fix: 'Connect your wallet only on sites you typed in yourself.',
    sources: ['extensions'],
  };
};

const typing: Rule = (r) => {
  const helper = r.found('extensions', 'Writing help');
  if (!helper) return null;
  return {
    id: 'typing',
    level: 'yellow',
    title: `${helper} reads what you type`,
    text: 'It runs on every site, this one included, so it sees what goes into forms and messages. The marks it leaves on the page tell sites it’s there.',
    sources: ['extensions'],
  };
};

const outdated: Rule = (r, crowd) => {
  const meta = r.meta('release');
  const behind = meta?.behind ?? 0;
  if (crowd || behind < 3 || !meta?.version) return null;
  return {
    id: 'outdated',
    level: 'red',
    title: `Your browser is ${behind} updates behind`,
    text: `It’s ${meta.version}, and ${meta.newest} is out. Every release patches security holes, and attackers go after the old versions on purpose.`,
    fix: 'Restart your browser: most updates wait for that.',
    sources: ['release'],
  };
};

const named: Rule = (r) => {
  const hits: [name: string, clause: string, source: string][] = [];
  const author = personName(r.fact('docs', 'Author'));
  if (author)
    hits.push([author, `${author} wrote the document you picked`, 'docs']);
  const editor = personName(r.fact('docs', 'Last edited by'));
  if (editor) hits.push([editor, `${editor} last edited it`, 'docs']);
  const owner = personName(r.fact('photo', 'Owner'));
  if (owner)
    hits.push([owner, `your photo names ${owner} as its owner`, 'photo']);
  for (const label of ['Camera', 'Microphone', 'Speakers']) {
    const device = r.fact('deviceNames', label);
    const name = ownerOf(device);
    if (name)
      hits.push([
        name,
        `your ${label.toLowerCase()} is called “${device}”`,
        'deviceNames',
      ]);
  }
  const nearby = r.fact('bluetooth', 'Device');
  const holder = ownerOf(nearby);
  if (holder)
    hits.push([
      holder,
      `a Bluetooth device is called “${nearby}”`,
      'bluetooth',
    ]);
  if (!hits.length) return null;
  const name = hits[0][0];
  return {
    id: 'name',
    level: 'red',
    title: `Your name, probably: ${name}`,
    text: `${capital(listText(hits.map(([, clause]) => clause)))}. With the fingerprint above, every visit from this browser now has a name on it.`,
    fix: 'Strip names from files before you send them, and name your devices something that isn’t you.',
    sources: [...new Set(hits.map(([, , source]) => source))],
    dossier: { who: name },
  };
};

const located: Rule = (r) => {
  const lat = r.fact('location', 'Latitude');
  const lon = r.fact('location', 'Longitude');
  const place = r.fact('photo', 'Place');
  if (!(lat && lon) && !place) return null;
  const parts: string[] = [];
  if (lat && lon)
    parts.push(
      `Your browser handed over ${lat}, ${lon}, give or take ${r.fact('location', 'Accuracy') ?? 'a little'}: that’s your street, maybe your door.`
    );
  if (place) {
    const height = r.fact('photo', 'Altitude');
    parts.push(
      `Your photo carries GPS: ${place}${height ? `, ${height}` : ''}. A photo taken at home is your address.`
    );
  }
  return {
    id: 'home',
    level: 'red',
    title:
      lat && lon
        ? 'It knows where you are'
        : 'It knows where that photo was taken',
    text: parts.join(' '),
    fix: place
      ? 'Turn off location for the camera, or remove it when you share: most share sheets have a switch.'
      : 'Only allow location to sites that need it, and only while you use them.',
    sources: [...(lat && lon ? ['location'] : []), ...(place ? ['photo'] : [])],
    replaces: ['city', 'place'],
    dossier: { where: `seen at ${lat && lon ? `${lat}, ${lon}` : place}` },
  };
};

const employer: Rule = (r) => {
  const company = r.fact('docs', 'Company');
  if (!company || GENERIC_COMPANY.test(company.trim())) return null;
  return {
    id: 'employer',
    level: 'red',
    title: `Where you work, probably: ${company}`,
    text: 'It’s written into the document you picked, next to who wrote it. Office stamps your organisation into every file you save.',
    fix: 'Check the file’s properties before you send a document outside.',
    sources: ['docs'],
    dossier: { work: `working at ${company}` },
  };
};

const secrets: Rule = (r) => {
  const keys = r.found('folder', 'Keys and secrets');
  if (!keys) return null;
  return {
    id: 'secrets',
    level: 'red',
    title: 'Your keys are within reach',
    text: `The folder you picked holds ${keys}. A page you hand a folder to can read those files, not just their names.`,
    fix: 'Never give a site a folder with keys in it, and keep keys out of project folders.',
    sources: ['folder'],
  };
};

const contacts: Rule = (r) => {
  const picked = r.number('contacts', 'Picked');
  if (!picked) return null;
  const names = r.fact('contacts', 'Names');
  return {
    id: 'contacts',
    level: 'red',
    title: `It has ${picked} of your contacts`,
    text: `${names ? `${names}: their` : 'Their'} numbers and emails are on this page now. A scam page would message them next, as you.`,
    fix: 'Share a contact only with an app you trust with all of them.',
    sources: ['contacts'],
  };
};

const device: Rule = (r) => {
  const system = r.lead('system');
  if (!system) return null;
  const gpu = r.lead('graphics');
  const chip = gpu && gpu !== 'Apple GPU' ? ` with ${article(gpu)} ${gpu}` : '';
  return {
    id: 'device',
    level: 'green',
    plain: true,
    title: `You’re on ${system}${chip}`,
    text: 'Every site sees this before you click anything, and picks what to show you from it.',
    sources: gpu ? ['system', 'graphics'] : ['system'],
  };
};

const place: Rule = (r) => {
  const region = r.fact('locale', 'Region');
  if (!region) return null;
  const currency = r.fact('locale', 'Currency');
  return {
    id: 'place',
    level: 'green',
    plain: true,
    title: `Your clock says ${region}`,
    text: `Your time zone is ${r.lead('locale')}${currency ? ` and your currency is the ${currency}` : ''}. No IP or permission needed.`,
    sources: ['locale'],
  };
};

const language: Rule = (r) => {
  const languages = r.fact('locale', 'Languages');
  if (!languages) return null;
  return {
    id: 'language',
    level: 'green',
    plain: true,
    title: `You read ${listText(languages.split(', '))}`,
    text: 'Your browser tells every site, so it can pick the language for you, and an ad network can pick the ads.',
    sources: ['locale', 'server'],
  };
};

const human: Rule = (r) => {
  if (r.lead('automation') !== 'Looks like a person') return null;
  const mouse = r.fact('automation', 'Mouse');
  return {
    id: 'human',
    level: 'green',
    plain: true,
    title: 'You’re a person, not a bot',
    text: `${mouse && mouse !== 'Not moved yet' ? `Your mouse moved like a hand: ${mouse}.` : 'You typed like a person.'} Bot checks score that quietly, all the time.`,
    sources: ['automation'],
  };
};

const battery: Rule = (r) => {
  const level = r.lead('battery');
  if (!level) return null;
  const charging = r.fact('battery', 'Charging') === 'Yes';
  return {
    id: 'battery',
    level: 'green',
    plain: true,
    title: `Your battery is at ${level}`,
    text: charging
      ? 'And charging: you’re near a socket, probably at a desk.'
      : 'And not charging: you’re away from a socket right now.',
    sources: ['battery'],
  };
};

const RULES: Rule[] = [
  robot,
  developer,
  gamer,
  creative,
  office,
  guarded,
  blurred,
  crowded,
  night,
  recognised,
  premium,
  vpn,
  city,
  health,
  watching,
  crypto,
  typing,
  outdated,
  named,
  located,
  employer,
  secrets,
  contacts,
  device,
  place,
  language,
  human,
  battery,
];

const MIN_SHOWN = 3;

const ORDER: Record<Level, number> = { green: 0, yellow: 1, red: 2 };

const POINTS: Record<Level, number> = { green: 3, yellow: 8, red: 16 };

const BANDS: [below: number, label: string, level: Level][] = [
  [30, 'Hard to pin down', 'green'],
  [55, 'Easy to profile', 'yellow'],
  [75, 'Easy to track', 'yellow'],
  [101, 'Easy to find', 'red'],
];

const verdictOf = (r: Read, shown: Insight[], crowd: boolean): Verdict => {
  let score = 12;
  const print = r.lead('fingerprint');
  if (crowd) score += 2;
  else if (print === 'Same on every visit') score += 22;
  else if (print) score += 8;
  if (r.meta('ip')?.city) score += 8;
  for (const insight of shown)
    if (!insight.plain) score += insight.score ?? POINTS[insight.level];
  score = Math.max(3, Math.min(99, Math.round(score)));
  const [, label, level] = BANDS.find(([below]) => score < below)!;
  const notes: Dossier = {};
  for (const insight of shown) Object.assign(notes, insight.dossier);
  const who =
    notes.who ??
    (notes.role ? `${capital(article(notes.role))} ${notes.role}` : 'Someone');
  const zone = r.meta('locale')?.city;
  const where = notes.where ?? (zone && !crowd ? `on ${zone} time` : null);
  const system = r.lead('system');
  const gpu = r.lead('graphics');
  const machine = system
    ? `on ${system}${gpu && gpu !== 'Apple GPU' ? ` with ${article(gpu)} ${gpu}` : ''}`
    : null;
  const parts = [notes.work, where, machine, notes.track].filter(Boolean);
  return {
    score,
    label,
    level,
    text: `${who}${parts.length ? `, ${parts.join(', ')}` : ''}.`,
  };
};

export const conclude = (results: Results) => {
  const r = reader(results);
  const crowd = inCrowd(r);
  const all = RULES.map((rule) => rule(r, crowd)).filter(
    (insight): insight is Insight => insight !== null
  );
  const replaced = new Set(all.flatMap((insight) => insight.replaces ?? []));
  const kept = all.filter((insight) => !replaced.has(insight.id));
  const sharp = kept.filter((insight) => !insight.plain);
  const plain = kept.filter((insight) => insight.plain);
  const shown = [
    ...sharp,
    ...plain.slice(0, Math.max(0, MIN_SHOWN - sharp.length)),
  ].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  return { insights: shown, verdict: verdictOf(r, shown, crowd) };
};
