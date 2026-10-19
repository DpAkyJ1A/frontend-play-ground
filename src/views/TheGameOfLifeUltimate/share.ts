import {
  formatRule,
  parseRle,
  parseRule,
  type Cell,
  type Rule,
} from './PatternLibrary/rle';

export const SHARE_FORMAT = 'the-game-of-life-ultimate';
export const HASH_KEY = 'board';
export const LINK_LIMIT = 8000;

export type Edges = 'walls' | 'wrap';

// Everything a share link or a saved file restores besides the cells.
export type ShareSettings = {
  cols: number;
  rows: number;
  cellSize: number;
  speed: number;
  rule: Rule;
  edges: Edges;
  colors: { alive: string; dead: string; grid: string };
  grid: boolean;
  fade: number;
};

// The JSON inside a link and a saved file. The rule goes as text (B3/S23).
export type SharePayload = {
  format: typeof SHARE_FORMAT;
  version: number;
  settings: Omit<ShareSettings, 'rule'> & { rule: string };
  rle?: string;
};

export type ShareLimits = {
  maxSize: number;
  minCellSize: number;
  maxCellSize: number;
  maxSpeed: number;
  maxFade: number;
};

export type SharedBoard = {
  settings: ShareSettings;
  cells: Cell[];
  hasBoard: boolean;
};

// A plain RLE file only knows the size, the edges and the rule.
export type RleBoard = Pick<
  ShareSettings,
  'cols' | 'rows' | 'edges' | 'rule'
> & { cells: Cell[] };

type BoardRleSource = {
  cols: number;
  rows: number;
  wrap: boolean;
  rule: Rule;
  isAlive: (x: number, y: number) => number | boolean;
  comment?: string | null;
};

const VERSION = 1;
const LINE_LENGTH = 70;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const BOARD_HEADER =
  /^\s*x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)\s*,\s*rule\s*=\s*([^\s:,]+):([PT])(\d+),(\d+)/im;

const runToken = (count: number, char: string) =>
  count > 1 ? `${count}${char}` : char;

export const encodeBoardRle = ({
  cols,
  rows,
  wrap,
  rule,
  isAlive,
  comment,
}: BoardRleSource) => {
  const lines = comment ? [`#C ${comment}`] : [];
  lines.push(
    `x = ${cols}, y = ${rows}, rule = ${formatRule(rule)}:${
      wrap ? 'T' : 'P'
    }${cols},${rows}`
  );
  let line = '';
  const write = (token: string) => {
    if (line.length + token.length > LINE_LENGTH) {
      lines.push(line);
      line = '';
    }
    line += token;
  };

  let lastRow = -1;
  for (let y = 0; y < rows; y++) {
    const runs: string[] = [];
    let state = 0;
    let run = 0;
    for (let x = 0; x < cols; x++) {
      const value = isAlive(x, y) ? 1 : 0;
      if (value === state) {
        run += 1;
        continue;
      }
      if (run) runs.push(runToken(run, state ? 'o' : 'b'));
      state = value;
      run = 1;
    }
    if (state) runs.push(runToken(run, 'o'));
    if (!runs.length) continue;
    const gap = lastRow < 0 ? y : y - lastRow;
    if (gap) write(runToken(gap, '$'));
    runs.forEach(write);
    lastRow = y;
  }
  write('!');
  lines.push(line);
  return lines.join('\n');
};

export const readBoardRle = (
  text: string,
  maxSize: number
): RleBoard | null => {
  const header = text.match(BOARD_HEADER);
  if (!header) return null;
  const [, x, y, ruleText, kind, w, h] = header;
  const rule = parseRule(ruleText);
  const cols = Number(w);
  const rows = Number(h);
  if (!rule || cols < 1 || rows < 1 || cols > maxSize || rows > maxSize) {
    return null;
  }
  const spansGrid = Number(x) === cols && Number(y) === rows;
  const dx = spansGrid ? 0 : Math.floor((cols - Number(x)) / 2);
  const dy = spansGrid ? 0 : Math.floor((rows - Number(y)) / 2);
  const cells = parseRle(text)
    .cells.map(([cx, cy]): Cell => [cx + dx, cy + dy])
    .filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < cols && cy < rows);
  return { cols, rows, edges: kind === 'T' ? 'wrap' : 'walls', rule, cells };
};

export const createPayload = (
  settings: ShareSettings,
  rle?: string
): SharePayload => ({
  format: SHARE_FORMAT,
  version: VERSION,
  settings: { ...settings, rule: formatRule(settings.rule) },
  ...(rle ? { rle } : {}),
});

const toNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(Math.max(Math.round(number), min), max)
    : fallback;
};

const toSize = (value: unknown, max: number) => {
  const size = Math.floor(Number(value));
  return size >= 1 ? Math.min(size, max) : 0;
};

const toColor = (value: unknown, fallback: string) =>
  typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

// `data` comes from a link or a file, so every field is checked.
export const readPayload = (
  data: unknown,
  fallback: ShareSettings,
  limits: ShareLimits
): SharedBoard | null => {
  if (
    !isRecord(data) ||
    data.format !== SHARE_FORMAT ||
    !isRecord(data.settings)
  ) {
    return null;
  }
  const s = data.settings;
  const colors: UnknownRecord = isRecord(s.colors) ? s.colors : {};
  const cols = toSize(s.cols, limits.maxSize);
  const rows = toSize(s.rows, limits.maxSize);
  if (!cols || !rows) return null;
  const rule = typeof s.rule === 'string' ? parseRule(s.rule) : null;
  const cells =
    typeof data.rle === 'string'
      ? parseRle(data.rle).cells.filter(([x, y]) => x < cols && y < rows)
      : [];
  return {
    settings: {
      cols,
      rows,
      cellSize: toNumber(
        s.cellSize,
        limits.minCellSize,
        limits.maxCellSize,
        fallback.cellSize
      ),
      speed: toNumber(s.speed, 0, limits.maxSpeed, fallback.speed),
      rule: rule ?? fallback.rule,
      edges: s.edges === 'wrap' ? 'wrap' : 'walls',
      colors: {
        alive: toColor(colors.alive, fallback.colors.alive),
        dead: toColor(colors.dead, fallback.colors.dead),
        grid: toColor(colors.grid, fallback.colors.grid),
      },
      grid: typeof s.grid === 'boolean' ? s.grid : fallback.grid,
      fade: toNumber(s.fade, 0, limits.maxFade, fallback.fade),
    },
    cells,
    hasBoard: typeof data.rle === 'string',
  };
};

const transform = async (
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(stream)
    ).arrayBuffer()
  );

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const encodeLinkData = async (payload: SharePayload) =>
  toBase64Url(
    await transform(
      new TextEncoder().encode(JSON.stringify(payload)),
      new CompressionStream('deflate-raw')
    )
  );

export const decodeLinkData = async (text: string): Promise<unknown> =>
  JSON.parse(
    new TextDecoder().decode(
      await transform(
        fromBase64Url(text),
        new DecompressionStream('deflate-raw')
      )
    )
  );

export const readHashData = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(HASH_KEY);
};
