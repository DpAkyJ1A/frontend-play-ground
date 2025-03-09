import { formatRule, parseRle, parseRule } from './PatternLibrary/rle';

export const SHARE_FORMAT = 'the-game-of-life-ultimate';
export const HASH_KEY = 'board';
export const LINK_LIMIT = 8000;

const VERSION = 1;
const LINE_LENGTH = 70;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const BOARD_HEADER =
  /^\s*x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)\s*,\s*rule\s*=\s*([^\s:,]+):([PT])(\d+),(\d+)/im;

const runToken = (count, char) => (count > 1 ? `${count}${char}` : char);

export const encodeBoardRle = ({
  cols,
  rows,
  wrap,
  rule,
  isAlive,
  comment,
}) => {
  const lines = comment ? [`#C ${comment}`] : [];
  lines.push(
    `x = ${cols}, y = ${rows}, rule = ${formatRule(rule)}:${
      wrap ? 'T' : 'P'
    }${cols},${rows}`
  );
  let line = '';
  const write = (token) => {
    if (line.length + token.length > LINE_LENGTH) {
      lines.push(line);
      line = '';
    }
    line += token;
  };

  let lastRow = -1;
  for (let y = 0; y < rows; y++) {
    const runs = [];
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

export const readBoardRle = (text, maxSize) => {
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
    .cells.map(([cx, cy]) => [cx + dx, cy + dy])
    .filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < cols && cy < rows);
  return { cols, rows, edges: kind === 'T' ? 'wrap' : 'walls', rule, cells };
};

export const createPayload = (settings, rle) => ({
  format: SHARE_FORMAT,
  version: VERSION,
  settings: { ...settings, rule: formatRule(settings.rule) },
  ...(rle ? { rle } : {}),
});

const toNumber = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(Math.max(Math.round(number), min), max)
    : fallback;
};

const toSize = (value, max) => {
  const size = Math.floor(Number(value));
  return size >= 1 ? Math.min(size, max) : 0;
};

const toColor = (value, fallback) =>
  typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;

export const readPayload = (data, fallback, limits) => {
  if (data?.format !== SHARE_FORMAT || typeof data.settings !== 'object') {
    return null;
  }
  const s = data.settings;
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
        alive: toColor(s.colors?.alive, fallback.colors.alive),
        dead: toColor(s.colors?.dead, fallback.colors.dead),
        grid: toColor(s.colors?.grid, fallback.colors.grid),
      },
      grid: typeof s.grid === 'boolean' ? s.grid : fallback.grid,
    },
    cells,
    hasBoard: typeof data.rle === 'string',
  };
};

const transform = async (bytes, stream) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(stream)
    ).arrayBuffer()
  );

const toBase64Url = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const encodeLinkData = async (payload) =>
  toBase64Url(
    await transform(
      new TextEncoder().encode(JSON.stringify(payload)),
      new CompressionStream('deflate-raw')
    )
  );

export const decodeLinkData = async (text) =>
  JSON.parse(
    new TextDecoder().decode(
      await transform(
        fromBase64Url(text),
        new DecompressionStream('deflate-raw')
      )
    )
  );

export const readHashData = (hash) => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(HASH_KEY);
};
