export type Dither = 'none' | 'floyd-steinberg' | 'atkinson' | 'bayer';

// How the image is scaled into the field.
export type Fit = 'fit' | 'fill' | 'stretch';

// Per-cell brightness (0 dark … 1 bright) and opacity, row by row.
export type Tones = { tones: Float32Array; alpha: Float32Array };

export type CellSettings = {
  threshold: number;
  dither: Dither;
  bright: boolean;
};

export type SuggestedSettings = { dither: Dither; invert: boolean };

type Kernel = { dx: number[]; dy: number[]; share: number[] };

export const DITHERS: { value: Dither; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'floyd-steinberg', label: 'Floyd–Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'bayer', label: 'Bayer' },
];

const SAMPLE_SIZE = 64;
const TONE_BINS = 32;
const BIN_SHARE = 0.01;
const PHOTO_BINS = 10;
const CLIP_SHARE = 0.01;
const MIN_RANGE = 0.1;

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36,
  14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23,
  61, 29, 53, 21,
].map((value) => (value + 0.5) / 64);

const toKernel = (
  taps: [dx: number, dy: number, share: number][]
): Kernel => ({
  dx: taps.map(([dx]) => dx),
  dy: taps.map(([, dy]) => dy),
  share: taps.map(([, , share]) => share),
});

const FLOYD_STEINBERG = toKernel([
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
]);

const ATKINSON = toKernel([
  [1, 0, 1 / 8],
  [2, 0, 1 / 8],
  [-1, 1, 1 / 8],
  [0, 1, 1 / 8],
  [1, 1, 1 / 8],
  [0, 2, 1 / 8],
]);

const parseHex = (hex: string): [r: number, g: number, b: number] => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const luma = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export const toPixel = (hex: string) => {
  const [r, g, b] = parseHex(hex);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
};

export const isBrighter = (hex: string, than: string) =>
  luma(...parseHex(hex)) > luma(...parseHex(than));

export const loadImage = async (file: Blob) => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty');
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawScaled = (
  image: HTMLImageElement,
  width: number,
  height: number
) => {
  let source: HTMLImageElement | HTMLCanvasElement = image;
  let w = image.naturalWidth;
  let h = image.naturalHeight;
  while (w > width * 2 && h > height * 2) {
    w = Math.ceil(w / 2);
    h = Math.ceil(h / 2);
    const step = createCanvas(w, h);
    const ctx = step.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    source = step;
  }
  return source;
};

const readPixels = (
  image: HTMLImageElement,
  cols: number,
  rows: number,
  fit: Fit
) => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale =
    fit === 'fill'
      ? Math.max(cols / width, rows / height)
      : Math.min(cols / width, rows / height);
  const w = fit === 'stretch' ? cols : width * scale;
  const h = fit === 'stretch' ? rows : height * scale;
  const canvas = createCanvas(cols, rows);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    drawScaled(image, Math.ceil(w), Math.ceil(h)),
    (cols - w) / 2,
    (rows - h) / 2,
    w,
    h
  );
  return ctx.getImageData(0, 0, cols, rows).data;
};

const stretchContrast = (tones: Float32Array, alpha: Float32Array) => {
  const histogram = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < tones.length; i++) {
    if (alpha[i] < 0.5) continue;
    histogram[Math.round(tones[i] * 255)] += 1;
    total += 1;
  }
  const clip = total * CLIP_SHARE;
  let low = 0;
  let high = 255;
  for (let seen = 0; low < 255 && seen + histogram[low] <= clip; low++) {
    seen += histogram[low];
  }
  for (let seen = 0; high > 0 && seen + histogram[high] <= clip; high--) {
    seen += histogram[high];
  }
  const range = (high - low) / 255;
  if (range < MIN_RANGE) return;
  const offset = low / 255;
  for (let i = 0; i < tones.length; i++) {
    tones[i] = Math.min(Math.max((tones[i] - offset) / range, 0), 1);
  }
};

export const readTones = (
  image: HTMLImageElement,
  cols: number,
  rows: number,
  fit: Fit
): Tones => {
  const data = readPixels(image, cols, rows, fit);
  const size = cols * rows;
  const tones = new Float32Array(size);
  const alpha = new Float32Array(size);
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    tones[i] = luma(data[p], data[p + 1], data[p + 2]);
    alpha[i] = data[p + 3] / 255;
  }
  stretchContrast(tones, alpha);
  return { tones, alpha };
};

const countTones = (tones: Float32Array, alpha: Float32Array) => {
  const bins = new Array<number>(TONE_BINS).fill(0);
  let total = 0;
  for (let i = 0; i < tones.length; i++) {
    if (alpha[i] < 0.5) continue;
    bins[Math.min(TONE_BINS - 1, Math.floor(tones[i] * TONE_BINS))] += 1;
    total += 1;
  }
  return bins.filter((count) => count >= total * BIN_SHARE).length;
};

export const suggestSettings = (
  image: HTMLImageElement,
  brightIsAlive: boolean
): SuggestedSettings => {
  const { tones, alpha } = readTones(
    image,
    SAMPLE_SIZE,
    SAMPLE_SIZE,
    'stretch'
  );
  if (countTones(tones, alpha) > PHOTO_BINS) {
    return { dither: 'floyd-steinberg', invert: false };
  }

  const border: number[] = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const last = SAMPLE_SIZE - 1;
    border.push(
      i,
      last * SAMPLE_SIZE + i,
      i * SAMPLE_SIZE,
      i * SAMPLE_SIZE + last
    );
  }
  const average = (list: number[]) =>
    list.reduce((sum, value) => sum + value, 0) / list.length;

  if (average(border.map((i) => alpha[i])) < 0.5) {
    let ink = 0;
    let weight = 0;
    for (let i = 0; i < tones.length; i++) {
      ink += (brightIsAlive ? tones[i] : 1 - tones[i]) * alpha[i];
      weight += alpha[i];
    }
    return { dither: 'none', invert: weight > 0 && ink / weight < 0.5 };
  }

  const background = average(border.map((i) => tones[i]));
  return { dither: 'none', invert: brightIsAlive === background > 0.5 };
};

const diffuse = (
  levels: Float32Array,
  alpha: Float32Array,
  cols: number,
  rows: number,
  { dx, dy, share }: Kernel
) => {
  const cells = new Uint8Array(levels.length);
  const taps = share.length;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!alpha[i]) continue;
      const alive = levels[i] >= 0.5 ? 1 : 0;
      cells[i] = alive;
      const error = levels[i] - alive;
      for (let k = 0; k < taps; k++) {
        const nx = x + dx[k];
        const ny = y + dy[k];
        if (nx < 0 || nx >= cols || ny >= rows) continue;
        levels[ny * cols + nx] += error * share[k];
      }
    }
  }
  return cells;
};

export const toCells = (
  { tones, alpha }: Tones,
  cols: number,
  rows: number,
  settings: CellSettings
) => {
  const { threshold, dither, bright } = settings;
  const size = cols * rows;
  const levels = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    levels[i] = (bright ? tones[i] : 1 - tones[i]) * alpha[i];
  }

  if (dither === 'floyd-steinberg' || dither === 'atkinson') {
    const shift = 0.5 - threshold;
    for (let i = 0; i < size; i++) levels[i] += shift;
    return diffuse(
      levels,
      alpha,
      cols,
      rows,
      dither === 'atkinson' ? ATKINSON : FLOYD_STEINBERG
    );
  }

  const cells = new Uint8Array(size);
  if (dither === 'bayer') {
    const shift = 0.5 - threshold;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        cells[i] =
          alpha[i] && levels[i] + shift > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0;
      }
    }
    return cells;
  }

  for (let i = 0; i < size; i++) cells[i] = levels[i] > threshold ? 1 : 0;
  return cells;
};
