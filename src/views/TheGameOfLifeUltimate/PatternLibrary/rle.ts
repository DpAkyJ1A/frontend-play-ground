export type Cell = [x: number, y: number];

export type Rule = { birth: number[]; survival: number[] };

export type Size = { width: number; height: number };

export type Shape = Size & { cells: Cell[] };

// What parseRle and parsePatternText turn a pattern text into.
export type ParsedPattern = Shape & { rule: Rule | null; name: string | null };

// Every message is a full sentence, so `if (result.error)` narrows the union.
export type PatternError = `${string}.`;

export type PatternTextResult =
  | { error: PatternError; pattern?: undefined }
  | { pattern: ParsedPattern; error?: undefined };

const toCounts = (text: string) =>
  [...new Set([...text].map(Number))]
    .filter((n) => n >= 0 && n <= 8)
    .sort((a, b) => a - b);

export const parseRule = (text: string): Rule | null => {
  const rule = text.toUpperCase().replace(/\s/g, '').split(':')[0];
  const birthFirst = rule.match(/^B(\d*)\/S(\d*)$/);
  if (birthFirst) {
    return {
      birth: toCounts(birthFirst[1]),
      survival: toCounts(birthFirst[2]),
    };
  }
  const survivalFirst =
    rule.match(/^S(\d*)\/B(\d*)$/) ?? rule.match(/^(\d*)\/(\d*)$/);
  if (survivalFirst) {
    return {
      birth: toCounts(survivalFirst[2]),
      survival: toCounts(survivalFirst[1]),
    };
  }
  return null;
};

export const formatRule = ({ birth, survival }: Rule) =>
  `B${[...birth].sort((a, b) => a - b).join('')}/S${[...survival]
    .sort((a, b) => a - b)
    .join('')}`;

export const parseRle = (text: string): ParsedPattern => {
  let width = 0;
  let height = 0;
  let rule: Rule | null = null;
  let name: string | null = null;
  const body: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#N')) name = line.slice(2).trim() || name;
    if (!line || line.startsWith('#')) continue;
    if (/^x\s*=/.test(line)) {
      const header: Partial<Record<string, string>> = Object.fromEntries(
        line.split(',').map((part) => part.split('=').map((s) => s.trim()))
      );
      width = Number(header.x) || 0;
      height = Number(header.y) || 0;
      rule = header.rule ? parseRule(header.rule) : null;
      continue;
    }
    body.push(line);
  }

  const cells: Cell[] = [];
  let x = 0;
  let y = 0;
  let run = '';
  let right = 0;
  let bottom = 0;
  for (const char of body.join('')) {
    if (/\s/.test(char)) continue;
    if (char >= '0' && char <= '9') {
      run += char;
      continue;
    }
    const count = run ? Number(run) : 1;
    run = '';
    if (char === '!') break;
    if (char === '$') {
      y += count;
      x = 0;
    } else if (char === 'b' || char === '.') {
      x += count;
    } else if (/[a-z]/i.test(char)) {
      for (let i = 0; i < count; i++) cells.push([x + i, y]);
      x += count;
      right = Math.max(right, x);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return {
    width: Math.max(width, right, 1),
    height: Math.max(height, bottom, 1),
    cells,
    rule,
    name,
  };
};

const parsePlaintext = (
  text: string
): Pick<ParsedPattern, 'cells' | 'rule' | 'name'> | null => {
  let name: string | null = null;
  const cells: Cell[] = [];
  let y = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.startsWith('!')) {
      const match = line.match(/^!\s*Name:\s*(.+)$/i);
      if (match) name = match[1].trim();
      continue;
    }
    if (!/^[.Oo*]*$/.test(line)) return null;
    [...line].forEach((char, x) => {
      if (char !== '.') cells.push([x, y]);
    });
    y += 1;
  }
  return { cells, rule: null, name };
};

const normalize = (cells: Cell[]): Shape => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [x, y] of cells) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    cells: cells.map(([x, y]) => [x - left, y - top]),
  };
};

export const parsePatternText = (
  text: string,
  maxSize: number
): PatternTextResult => {
  const source = text.replace(/\r/g, '').trim();
  if (!source) return { error: 'Paste a pattern first.' };
  const isRle = /^\s*x\s*=/m.test(source) || /^[\dbo$\s]*!$/.test(source);
  const parsed = isRle ? parseRle(source) : parsePlaintext(source);
  if (!parsed) {
    return {
      error:
        "This doesn't look like RLE or plaintext. Copy the RLE block from a LifeWiki pattern page: it starts with a line like x = 3, y = 3.",
    };
  }
  if (!parsed.cells.length) return { error: 'No live cells found in it.' };
  const shape = normalize(parsed.cells);
  if (shape.width > maxSize || shape.height > maxSize) {
    return {
      error: `It's ${shape.width}×${shape.height}. The field can't be bigger than ${maxSize}×${maxSize}.`,
    };
  }
  return { pattern: { ...shape, rule: parsed.rule, name: parsed.name } };
};

export const transformShape = (
  { width, height, cells }: Shape,
  rotation: number,
  flipped: boolean
): Shape => {
  let w = width;
  let h = height;
  let result: Cell[] = flipped
    ? cells.map(([x, y]) => [width - 1 - x, y])
    : cells;
  for (let i = 0; i < rotation; i++) {
    const rows = h;
    result = result.map(([x, y]) => [rows - 1 - y, x]);
    [w, h] = [h, w];
  }
  return { width: w, height: h, cells: result };
};
