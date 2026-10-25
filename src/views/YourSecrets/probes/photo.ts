import type { Fact, Probe, ProbeResult } from './types';
import { isMovie, readMovie, type Movie } from './movie';
import { MONTHS, binaryString, dateTime, duration, nextTask } from './utils';

type Value = string | number | number[];
type Tags = Map<number, Value>;

const SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

const IFD0 = {
  make: 0x010f,
  model: 0x0110,
  software: 0x0131,
  artist: 0x013b,
  exif: 0x8769,
  gps: 0x8825,
};
const EXIF = {
  exposure: 0x829a,
  fNumber: 0x829d,
  iso: 0x8827,
  taken: 0x9003,
  offset: 0x9011,
  focal: 0x920a,
  focal35: 0xa405,
  owner: 0xa430,
  serial: 0xa431,
  lens: 0xa434,
};
const GPS = { latRef: 1, lat: 2, lonRef: 3, lon: 4, altRef: 5, alt: 6 };
const THUMB = { offset: 0x0201, length: 0x0202 };

const tiffAt = (bytes: Uint8Array, from: number, to: number) => {
  for (
    let i = bytes.indexOf(0x2a, from);
    i !== -1 && i < to;
    i = bytes.indexOf(0x2a, i + 1)
  ) {
    const little =
      bytes[i - 2] === 0x49 && bytes[i - 1] === 0x49 && bytes[i + 1] === 0;
    const big =
      bytes[i - 3] === 0x4d && bytes[i - 2] === 0x4d && bytes[i - 1] === 0;
    const start = little ? i - 2 : big ? i - 3 : -1;
    if (start < 0) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset + start);
    if (view.byteLength >= 8 && view.getUint32(4, little) === 8) return start;
  }
  return -1;
};

const findTiff = async (bytes: Uint8Array) => {
  const STEP = 4 << 20;
  for (let from = 2; from < bytes.length; from += STEP) {
    const at = tiffAt(bytes, from, Math.min(bytes.length, from + STEP));
    if (at >= 0) return at;
    await nextTask();
  }
  return -1;
};

const reader = (view: DataView, little: boolean) => {
  const fits = (at: number, size: number) =>
    at >= 0 && at + size <= view.byteLength;
  const list = (offset: number): { tags: Tags; next: number } => {
    const tags: Tags = new Map();
    if (!fits(offset, 2)) return { tags, next: 0 };
    const count = view.getUint16(offset, little);
    for (let i = 0; i < count; i++) {
      const entry = offset + 2 + i * 12;
      if (!fits(entry, 12)) break;
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      const n = view.getUint32(entry + 4, little);
      const size = (SIZES[type] ?? 0) * n;
      if (!size) continue;
      const at = size <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
      if (!fits(at, size)) continue;
      if (type === 2) {
        let text = '';
        for (let j = 0; j < n; j++) {
          const c = view.getUint8(at + j);
          if (!c) break;
          text += String.fromCharCode(c);
        }
        tags.set(tag, text.trim());
      } else if (type === 5 || type === 10) {
        const parts = Array.from({ length: n }, (_, j) => {
          const num =
            type === 5
              ? view.getUint32(at + j * 8, little)
              : view.getInt32(at + j * 8, little);
          const den =
            type === 5
              ? view.getUint32(at + j * 8 + 4, little)
              : view.getInt32(at + j * 8 + 4, little);
          return den ? num / den : 0;
        });
        tags.set(tag, n === 1 ? parts[0] : parts);
      } else if (type === 3) tags.set(tag, view.getUint16(at, little));
      else if (type === 4 || type === 9)
        tags.set(tag, view.getUint32(at, little));
      else if (type === 1) tags.set(tag, view.getUint8(at));
    }
    const end = offset + 2 + count * 12;
    return { tags, next: fits(end, 4) ? view.getUint32(end, little) : 0 };
  };
  return list;
};

const parse = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = await findTiff(bytes);
  if (start < 0) return null;
  const view = new DataView(bytes.buffer, start);
  const little = bytes[start] === 0x49;
  const list = reader(view, little);
  const main = list(8);
  const pointer = (tag: number) => {
    const at = main.tags.get(tag);
    return typeof at === 'number' && at > 0
      ? list(at).tags
      : new Map<number, Value>();
  };
  const thumbList = main.next ? list(main.next).tags : null;
  const thumbAt = thumbList?.get(THUMB.offset);
  const thumbLength = thumbList?.get(THUMB.length);
  const thumb =
    typeof thumbAt === 'number' &&
    typeof thumbLength === 'number' &&
    thumbAt + thumbLength <= view.byteLength
      ? bytes.subarray(start + thumbAt, start + thumbAt + thumbLength)
      : null;
  return {
    main: main.tags,
    exif: pointer(IFD0.exif),
    gps: pointer(IFD0.gps),
    thumb,
  };
};

const text = (tags: Tags, tag: number) => {
  const value = tags.get(tag);
  return typeof value === 'string' && value ? value : null;
};

const num = (tags: Tags, tag: number) => {
  const value = tags.get(tag);
  return typeof value === 'number' && value > 0 ? value : null;
};

const when = (stamp: string | null, offset: string | null) => {
  const m = stamp?.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}, ${m[4]}:${m[5]}${offset ? `, UTC${offset}` : ''}`;
};

const degrees = (value: Value | undefined, ref: string | null) => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const deg = value[0] + value[1] / 60 + value[2] / 3600;
  return ref === 'S' || ref === 'W' ? -deg : deg;
};

const cameraName = (make: string | null, model: string | null) =>
  model ? (make && !model.startsWith(make) ? `${make} ${model}` : model) : make;

const softwareName = (software: string | null, make: string | null) =>
  software && make === 'Apple' && /^\d+(\.\d+)*$/.test(software)
    ? `iOS ${software}`
    : software;

const isoWhen = (stamp: string | null) => {
  const m = stamp?.match(
    /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::[\d.]+)?(Z|[+-]\d\d:?\d\d)?/
  );
  const month = m && MONTHS[Number(m[2]) - 1];
  if (!m || !month) return null;
  const zone =
    m[6] === 'Z'
      ? 'UTC'
      : m[6]
        ? `UTC${m[6].slice(0, 3)}:${m[6].slice(-2)}`
        : '';
  return `${Number(m[3])} ${month} ${m[1]}, ${m[4]}:${m[5]}${zone ? `, ${zone}` : ''}`;
};

const mapLink = (lat: number, lon: number) => ({
  href: `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=17/${lat.toFixed(5)}/${lon.toFixed(5)}`,
  label: 'See where on OpenStreetMap',
});

const EMPTY: Fact[] = [
  ['Camera', null],
  ['Lens', null],
  ['Taken', null],
  ['Settings', null],
  ['Software', null],
  ['Place', null],
  ['Altitude', null],
  ['Owner', null],
  ['Small copy inside', null],
  ['File saved', null],
];

const readVideo = async (
  file: File,
  saved: string | null
): Promise<ProbeResult> => {
  let movie: Movie | null = null;
  try {
    movie = await readMovie(file);
  } catch {
    movie = null;
  }
  const camera = cameraName(movie?.make ?? null, movie?.model ?? null);
  const place =
    movie && movie.lat !== null && movie.lon !== null
      ? { lat: movie.lat, lon: movie.lon }
      : null;
  return {
    lead: place
      ? `${camera ?? 'A video'}, with where it was filmed`
      : (camera ?? (movie ? 'A video' : 'Nothing inside')),
    guarded: !movie,
    facts: [
      ['Camera', camera],
      ['Lens', null],
      ['Taken', isoWhen(movie?.taken ?? null)],
      [
        'Settings',
        movie?.seconds ? `${duration(movie.seconds * 1000)} long` : null,
      ],
      ['Software', softwareName(movie?.software ?? null, movie?.make ?? null)],
      ['Place', place && `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`],
      [
        'Altitude',
        movie?.alt
          ? `${Math.round(Math.abs(movie.alt))} m ${movie.alt < 0 ? 'below' : 'above'} sea level`
          : null,
      ],
      ['Owner', null],
      ['Small copy inside', null],
      ['File saved', saved],
    ],
    link: place ? mapLink(place.lat, place.lon) : undefined,
  };
};

const read = async (file: File): Promise<ProbeResult> => {
  const saved = file.lastModified
    ? dateTime(new Date(file.lastModified))
    : null;
  if (await isMovie(file).catch(() => false)) return readVideo(file, saved);
  let data: Awaited<ReturnType<typeof parse>> = null;
  try {
    data = await parse(file);
  } catch {
    data = null;
  }
  if (!data)
    return {
      lead: 'Nothing inside: stripped, or a screenshot',
      guarded: true,
      facts: EMPTY.map(([label]) => [
        label,
        label === 'File saved' ? saved : null,
      ]),
    };
  const { main, exif, gps, thumb } = data;
  const make = text(main, IFD0.make);
  const model = text(main, IFD0.model);
  const camera = cameraName(make, model);
  const exposure = num(exif, EXIF.exposure);
  const fNumber = num(exif, EXIF.fNumber);
  const iso = num(exif, EXIF.iso);
  const focal35 = num(exif, EXIF.focal35);
  const focal = num(exif, EXIF.focal);
  const settings = [
    exposure &&
      (exposure < 1
        ? `1/${Math.round(1 / exposure)} s`
        : `${+exposure.toFixed(1)} s`),
    fNumber && `f/${+fNumber.toFixed(1)}`,
    iso && `ISO ${iso}`,
    focal35 ? `${focal35} mm` : focal && `${+focal.toFixed(1)} mm`,
  ].filter(Boolean);
  const lat = degrees(gps.get(GPS.lat), text(gps, GPS.latRef));
  const lon = degrees(gps.get(GPS.lon), text(gps, GPS.lonRef));
  const place =
    lat !== null && lon !== null && (lat || lon) ? { lat, lon } : null;
  const alt = num(gps, GPS.alt);
  const owner = [
    text(exif, EXIF.owner) ?? text(main, IFD0.artist),
    text(exif, EXIF.serial) && `serial ${text(exif, EXIF.serial)}`,
  ]
    .filter(Boolean)
    .join(', ');
  const coords = place && `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`;
  return {
    lead: place
      ? `${camera ?? 'A photo'}, with where it was taken`
      : (camera ?? 'Some details inside'),
    facts: [
      ['Camera', camera],
      ['Lens', text(exif, EXIF.lens)],
      ['Taken', when(text(exif, EXIF.taken), text(exif, EXIF.offset))],
      ['Settings', settings.length ? settings.join(' · ') : null],
      ['Software', softwareName(text(main, IFD0.software), make)],
      ['Place', coords],
      [
        'Altitude',
        alt
          ? `${Math.round(alt)} m ${gps.get(GPS.altRef) === 1 ? 'below' : 'above'} sea level`
          : null,
      ],
      ['Owner', owner || null],
      [
        'Small copy inside',
        thumb
          ? `Yes, ${Math.max(1, Math.round(thumb.length / 1000))} KB`
          : 'No',
      ],
      ['File saved', saved],
    ],
    link: place ? mapLink(place.lat, place.lon) : undefined,
    image: thumb
      ? {
          src: `data:image/jpeg;base64,${btoa(binaryString(thumb))}`,
          alt: 'The small copy stored inside the file',
        }
      : undefined,
  };
};

const photo: Probe = {
  id: 'photo',
  title: 'Photo and video details',
  category: 'Location',
  access: 'gesture',
  weight: 6,
  compat: [
    'api.HTMLInputElement.files',
    'api.Blob.arrayBuffer',
    'api.File.lastModified',
  ],
  how: 'A file input: the page reads the photo you pick and finds the EXIF block in it, or reads the moov box of a video: QuickTime metadata and ©xyz. Nothing is uploaded.',
  why: 'Photos and videos straight from a phone carry the camera, the time and often the exact spot they were taken. Many sites strip it on upload; any page you hand the file to can read it first.',
  action: 'Pick a photo or a video',
  accept: 'image/*,video/*',
  note: 'Try one straight from your phone. Nothing leaves your device.',
  async collect() {
    return { lead: null, facts: EMPTY };
  },
  readFile: read,
};

export default photo;
