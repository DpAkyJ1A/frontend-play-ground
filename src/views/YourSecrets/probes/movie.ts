export type Movie = {
  make: string | null;
  model: string | null;
  software: string | null;
  taken: string | null;
  seconds: number | null;
  lat: number | null;
  lon: number | null;
  alt: number | null;
};

const BRANDS = /^(qt {2}|isom|iso\d|mp4\d|avc1|M4V |3gp\d|3g2a|MSNV|dash)$/;

const ascii = (view: DataView, at: number, length: number) => {
  let out = '';
  for (let i = 0; i < length && at + i < view.byteLength; i++)
    out += String.fromCharCode(view.getUint8(at + i));
  return out;
};

const utf8 = (view: DataView, at: number, length: number) =>
  new TextDecoder().decode(
    new Uint8Array(
      view.buffer,
      view.byteOffset + at,
      Math.max(0, Math.min(length, view.byteLength - at))
    )
  );

export const isMovie = async (file: File) => {
  const head = new DataView(await file.slice(0, 12).arrayBuffer());
  return (
    head.byteLength >= 12 &&
    ascii(head, 4, 4) === 'ftyp' &&
    BRANDS.test(ascii(head, 8, 4))
  );
};

const findMoov = async (file: File) => {
  let at = 0;
  for (let i = 0; i < 64 && at + 8 <= file.size; i++) {
    const head = new DataView(await file.slice(at, at + 16).arrayBuffer());
    let size = head.getUint32(0);
    const type = ascii(head, 4, 4);
    if (size === 1) size = Number(head.getBigUint64(8));
    else if (size === 0) size = file.size - at;
    if (size < 8) return null;
    if (type === 'moov')
      return size > 32 << 20
        ? null
        : new DataView(await file.slice(at, at + size).arrayBuffer());
    at += size;
  }
  return null;
};

type Box = { type: string; start: number; end: number };

const children = (view: DataView, start: number, end: number): Box[] => {
  const list: Box[] = [];
  for (let at = start; at + 8 <= end; ) {
    const size = view.getUint32(at);
    if (size < 8 || at + size > end) break;
    list.push({ type: ascii(view, at + 4, 4), start: at + 8, end: at + size });
    at += size;
  }
  return list;
};

const iso6709 = (value: string | null) => {
  const m = value?.match(
    /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?/
  );
  return m
    ? { lat: Number(m[1]), lon: Number(m[2]), alt: m[3] ? Number(m[3]) : null }
    : null;
};

export const readMovie = async (file: File): Promise<Movie | null> => {
  const moov = await findMoov(file);
  if (!moov) return null;
  const top = children(moov, 8, moov.byteLength);
  const found: Record<string, string> = {};
  let seconds: number | null = null;
  let created: Date | null = null;

  const mvhd = top.find((b) => b.type === 'mvhd');
  if (mvhd) {
    const v1 = moov.getUint8(mvhd.start) === 1;
    const at = mvhd.start + 4;
    const since1904 = v1 ? Number(moov.getBigUint64(at)) : moov.getUint32(at);
    const scale = moov.getUint32(at + (v1 ? 16 : 8));
    const length = v1
      ? Number(moov.getBigUint64(at + 20))
      : moov.getUint32(at + 12);
    if (since1904) created = new Date((since1904 - 2082844800) * 1000);
    if (scale) seconds = length / scale;
  }

  for (const udta of top.filter((b) => b.type === 'udta'))
    for (const box of children(moov, udta.start, udta.end)) {
      if (box.type.charCodeAt(0) !== 0xa9) continue;
      const length = moov.getUint16(box.start);
      found[box.type.slice(1)] = utf8(moov, box.start + 4, length);
    }

  const meta = top.find((b) => b.type === 'meta');
  if (meta) {
    const start =
      ascii(moov, meta.start + 4, 4) === 'hdlr' ? meta.start : meta.start + 4;
    const boxes = children(moov, start, meta.end);
    const keys = boxes.find((b) => b.type === 'keys');
    const ilst = boxes.find((b) => b.type === 'ilst');
    if (keys && ilst) {
      const names: string[] = [];
      for (
        let at = keys.start + 8, n = moov.getUint32(keys.start + 4);
        n > 0 && at + 8 <= keys.end;
        n--
      ) {
        const size = moov.getUint32(at);
        if (size < 8) break;
        names.push(ascii(moov, at + 8, size - 8));
        at += size;
      }
      for (const item of children(moov, ilst.start, ilst.end)) {
        const index = moov.getUint32(item.start - 4);
        const data = children(moov, item.start, item.end).find(
          (b) => b.type === 'data'
        );
        const key = names[index - 1];
        if (key && data && moov.getUint32(data.start) === 1)
          found[key] = utf8(moov, data.start + 8, data.end - data.start - 8);
      }
    }
  }

  const q = (name: string) =>
    found[`com.apple.quicktime.${name}`]?.trim() || null;
  const place = iso6709(q('location.ISO6709') ?? found.xyz ?? null);
  return {
    make: q('make') ?? found.mak?.trim() ?? null,
    model: q('model') ?? found.mod?.trim() ?? null,
    software: q('software') ?? found.swr?.trim() ?? null,
    taken: q('creationdate') ?? (created ? created.toISOString() : null),
    seconds,
    lat: place?.lat ?? null,
    lon: place?.lon ?? null,
    alt: place?.alt ?? null,
  };
};
