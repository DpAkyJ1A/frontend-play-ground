import type { Fact, Probe, ProbeResult } from './types';
import { binaryString, dateTime, nextTask } from './utils';

type Details = {
  title?: string | null;
  author?: string | null;
  editor?: string | null;
  company?: string | null;
  app?: string | null;
  created?: Date | null;
  saved?: Date | null;
  minutes?: number | null;
  revisions?: string | null;
};

const clean = (value: string | null | undefined) =>
  value?.replace(/\s+/g, ' ').trim() || null;

const unescapeXml = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const isoDate = (value: string | null) => (value ? new Date(value) : null);

const pdfText = (raw: string) => {
  if (raw.startsWith('þÿ')) {
    let out = '';
    for (let i = 2; i + 1 < raw.length; i += 2)
      out += String.fromCharCode(
        (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1)
      );
    return out;
  }
  return raw;
};

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  '\n': '',
};

const literal = (body: string) =>
  body.replace(/\\(\d{1,3}|.)/gs, (_, esc: string) =>
    /\d/.test(esc[0])
      ? String.fromCharCode(parseInt(esc, 8))
      : (ESCAPES[esc] ?? esc)
  );

const hex = (body: string) => {
  const digits = body.replace(/\s/g, '');
  let out = '';
  for (let i = 0; i < digits.length; i += 2)
    out += String.fromCharCode(
      parseInt(digits.slice(i, i + 2).padEnd(2, '0'), 16)
    );
  return out;
};

const lastValue = (text: string, key: string) => {
  const re = new RegExp(
    `/${key}\\s*(\\((?:\\\\.|\\((?:\\\\.|[^\\\\()])*\\)|[^\\\\()])*\\)|<[0-9A-Fa-f\\s]*>)`,
    'gs'
  );
  let last: string | null = null;
  for (const [, value] of text.matchAll(re))
    last = value.startsWith('(')
      ? literal(value.slice(1, -1))
      : hex(value.slice(1, -1));
  return last === null ? null : clean(pdfText(last));
};

const infoObject = (text: string) => {
  const ref = [...text.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/g)].pop();
  if (!ref) return null;
  const at = [
    ...text.matchAll(new RegExp(`(?:^|\\s)${ref[1]}\\s+${ref[2]}\\s+obj`, 'g')),
  ].pop()?.index;
  if (at === undefined) return null;
  const end = text.indexOf('endobj', at);
  return text.slice(at, end < 0 ? undefined : end);
};

const pdfDate = (value: string | null) => {
  const m = value?.match(
    /^D?:?(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?([Z+-])?(\d\d)?'?(\d\d)?/
  );
  if (!m) return null;
  const [
    ,
    y,
    mo = '01',
    d = '01',
    h = '00',
    mi = '00',
    s = '00',
    sign,
    oh = '00',
    om = '00',
  ] = m;
  const zone = !sign || sign === 'Z' ? 'Z' : `${sign}${oh}:${om}`;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone}`);
};

const xmpValue = (xmp: string, tag: string) => {
  const re = new RegExp(
    `<${tag}[^>]*>\\s*(?:<rdf:(?:Seq|Bag|Alt)[^>]*>\\s*<rdf:li[^>]*>)?([^<]*)<|${tag}="([^"]*)"`
  );
  const m = xmp.match(re);
  return clean(unescapeXml(m?.[1] ?? m?.[2] ?? ''));
};

const readPdf = async (file: File): Promise<Details> => {
  const EDGE = 1 << 20;
  const parts =
    file.size <= EDGE * 2
      ? [file]
      : [file.slice(0, EDGE), file.slice(file.size - EDGE)];
  const bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
  const text = binaryString(bytes);
  await nextTask();
  const start = text.indexOf('<x:xmpmeta');
  const end = start >= 0 ? text.indexOf('</x:xmpmeta>', start) : -1;
  const xmp =
    end > start ? new TextDecoder().decode(bytes.subarray(start, end)) : '';
  const info = infoObject(text);
  const value = (key: string) =>
    (info && lastValue(info, key)) ?? lastValue(text, key);
  const creator = value('Creator') ?? xmpValue(xmp, 'xmp:CreatorTool');
  const producer = value('Producer') ?? xmpValue(xmp, 'pdf:Producer');
  return {
    title: (info && lastValue(info, 'Title')) ?? xmpValue(xmp, 'dc:title'),
    author: value('Author') ?? xmpValue(xmp, 'dc:creator'),
    company: value('Company'),
    app:
      creator && producer && !producer.includes(creator)
        ? `${creator}, made into a PDF by ${producer}`
        : (creator ?? producer),
    created:
      pdfDate(value('CreationDate')) ??
      isoDate(xmpValue(xmp, 'xmp:CreateDate')),
    saved:
      pdfDate(value('ModDate')) ?? isoDate(xmpValue(xmp, 'xmp:ModifyDate')),
  };
};

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`));
  return m ? clean(unescapeXml(m[1])) : null;
};

const unzip = async (file: File, wanted: string[]) => {
  const tailSize = Math.min(file.size, 0xffff + 22);
  const tail = new DataView(
    await file.slice(file.size - tailSize).arrayBuffer()
  );
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return new Map<string, string>();
  const dirSize = tail.getUint32(eocd + 12, true);
  const dirAt = tail.getUint32(eocd + 16, true);
  const dir = new DataView(
    await file.slice(dirAt, dirAt + dirSize).arrayBuffer()
  );
  const found = new Map<string, string>();
  for (
    let at = 0;
    at + 46 <= dir.byteLength && dir.getUint32(at, true) === 0x02014b50;

  ) {
    const method = dir.getUint16(at + 10, true);
    const compressed = dir.getUint32(at + 20, true);
    const nameLength = dir.getUint16(at + 28, true);
    const extraLength = dir.getUint16(at + 30, true);
    const commentLength = dir.getUint16(at + 32, true);
    const local = dir.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      new Uint8Array(dir.buffer, dir.byteOffset + at + 46, nameLength)
    );
    at += 46 + nameLength + extraLength + commentLength;
    if (!wanted.includes(name) || compressed > 1 << 20) continue;
    const header = new DataView(
      await file.slice(local, local + 30).arrayBuffer()
    );
    const dataAt =
      local + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    const data = file.slice(dataAt, dataAt + compressed);
    const stream =
      method === 8
        ? data.stream().pipeThrough(new DecompressionStream('deflate-raw'))
        : method === 0
          ? data.stream()
          : null;
    if (stream) found.set(name, await new Response(stream).text());
  }
  return found;
};

const isoMinutes = (value: string | null) => {
  const m = value?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  return m
    ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
    : null;
};

const generator = (value: string | null) => {
  if (!value) return null;
  const [name, rest] = value.split('$');
  const os = rest?.split(' ')[0].replace(/_/g, ' ');
  return `${name.replace(/\//g, ' ')}${os ? ` on ${os}` : ''}`;
};

const readOffice = async (file: File): Promise<Details> => {
  const files = await unzip(file, [
    'docProps/core.xml',
    'docProps/app.xml',
    'meta.xml',
  ]);
  const core = files.get('docProps/core.xml');
  const app = files.get('docProps/app.xml') ?? '';
  const odf = files.get('meta.xml');
  if (odf)
    return {
      title: tag(odf, 'dc:title'),
      author: tag(odf, 'meta:initial-creator'),
      editor: tag(odf, 'dc:creator'),
      app: generator(tag(odf, 'meta:generator')),
      created: isoDate(tag(odf, 'meta:creation-date')),
      saved: isoDate(tag(odf, 'dc:date')),
      minutes: isoMinutes(tag(odf, 'meta:editing-duration')),
      revisions: tag(odf, 'meta:editing-cycles'),
    };
  if (!core) return {};
  const name = tag(app, 'Application');
  const version = tag(app, 'AppVersion');
  const minutes = tag(app, 'TotalTime');
  return {
    title: tag(core, 'dc:title'),
    author: tag(core, 'dc:creator'),
    editor: tag(core, 'cp:lastModifiedBy'),
    company: tag(app, 'Company'),
    app: name
      ? `${name}${version ? ` ${version.replace(/\.0+$/, '')}` : ''}`
      : null,
    created: isoDate(tag(core, 'dcterms:created')),
    saved: isoDate(tag(core, 'dcterms:modified')),
    minutes: minutes ? Number(minutes) : null,
    revisions: tag(core, 'cp:revision'),
  };
};

const minutesText = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n)
    ? null
    : n < 60
      ? `${n} min`
      : `${Math.floor(n / 60)} h ${n % 60} min`;

const EMPTY: Fact[] = [
  ['Author', null],
  ['Last edited by', null],
  ['Company', null],
  ['Made with', null],
  ['Created', null],
  ['Last saved', null],
  ['Editing time', null],
  ['Revisions', null],
];

const read = async (file: File): Promise<ProbeResult> => {
  let details: Details | null = null;
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const sig = String.fromCharCode(...head);
    details =
      sig === '%PDF'
        ? await readPdf(file)
        : sig === 'PK\u0003\u0004'
          ? await readOffice(file)
          : null;
  } catch {
    details = null;
  }
  if (!details)
    return { lead: 'Not a PDF or an Office file', guarded: true, facts: EMPTY };
  const author = clean(details.author);
  const editor = clean(details.editor);
  const facts: Fact[] = [
    ['Author', author],
    ['Last edited by', editor],
    ['Company', clean(details.company)],
    ['Made with', clean(details.app)],
    ['Created', dateTime(details.created)],
    ['Last saved', dateTime(details.saved)],
    ['Editing time', minutesText(details.minutes)],
    ['Revisions', clean(details.revisions)],
  ];
  const found = facts.some(([, value]) => value);
  const person = author ?? editor;
  return {
    lead: person
      ? `Written by ${person}`
      : found
        ? (clean(details.title) ?? 'Some details inside')
        : 'Nothing inside',
    guarded: !found,
    facts,
  };
};

const docs: Probe = {
  id: 'docs',
  title: 'Document details',
  category: 'Behaviour',
  access: 'gesture',
  weight: 6,
  compat: [
    'api.HTMLInputElement.files',
    'api.Blob.slice',
    'api.DecompressionStream',
  ],
  how: 'A file input: the page reads the Info dictionary and the XMP block of a PDF, or unzips docProps/core.xml and app.xml of a Word, Excel or PowerPoint file (meta.xml for OpenDocument). Nothing is uploaded.',
  why: 'Office writes your name, often your company, and how long you spent on a file into the file itself, and a PDF made from it keeps the name. Anyone you send it to can read it, and so can any page you hand it to.',
  action: 'Pick a document',
  accept: '.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,application/pdf',
  note: 'A PDF, Word, Excel or PowerPoint file. Nothing leaves your device.',
  async collect() {
    return { lead: null, facts: EMPTY };
  },
  readFile: read,
};

export default docs;
