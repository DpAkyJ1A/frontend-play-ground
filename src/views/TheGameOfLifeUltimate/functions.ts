const V8_SLOT_BYTES = 4;
const V8_ARRAY_BYTES = 32;

// Edge mode: `limited` stops at the walls, `closed` wraps around.
export type FieldType = 'limited' | 'closed';

export type Field2d = number[][];
export type Field1d = number[];
export type BitField = {
  width: number;
  height: number;
  wordsPerRow: number;
  cells: Uint32Array;
  buffer: Uint32Array;
};
export type Field = Field2d | Field1d | BitField;

export type StepOptions = {
  width: number;
  height: number;
  wrap: boolean;
  birthRules: number[];
  survivalRules: number[];
};

export type EngineMemory = {
  bytes: number;
  perStep: number;
  estimated: boolean;
};

// Method syntax on purpose: the page keeps the current engine and its field
// in refs, so each engine has to pass as a plain `Engine`. The engines below
// use `satisfies` to keep their own narrower signatures (bit array `get` and
// `set` take no width).
export type Engine<F extends Field = Field> = {
  generateField(width: number, height: number): F;
  updateFieldDimensions(
    prevField: F,
    newHeight: number,
    newWidth: number,
    prevHeight: number,
    prevWidth: number
  ): F;
  randomFill(randomIndex: number, height: number, width: number): F;
  get(field: F, x: number, y: number, width: number): number;
  set(field: F, x: number, y: number, value: number, width: number): void;
  toBits(field: F, width: number, height: number, out: Uint32Array): void;
  makeAStep(field: F, options: StepOptions): { field: F; alive: number };
  paint(
    field: F,
    pixels: Uint32Array,
    aliveColor: number,
    deadColor: number
  ): void;
  countAliveCells(field: F): number;
  memory(width: number, height: number): EngineMemory;
};

// The array engines count neighbors one way for walls and another for wrap.
type NeighborCounters<F extends Field> = Record<
  'countNeighborsLimited' | 'countNeighborsClosed',
  (field: F, a: number, b: number) => number
>;

export type RuleKernel = (
  s0: number,
  s1: number,
  s2: number,
  s3: number,
  c: number
) => number;

const checkRules = (
  currentState: number,
  neighbors: number,
  birthRules: number[],
  survivalRules: number[]
) => {
  if (currentState === 1) {
    return survivalRules.includes(neighbors) ? 1 : 0;
  } else {
    return birthRules.includes(neighbors) ? 1 : 0;
  }
};

export const f_2dArray = {
  generateField: (width, height) => {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 0)
    );
  },

  updateFieldDimensions: (prevField, newHeight, newWidth) => {
    const updatedField = Array.from({ length: newHeight }, () =>
      Array.from({ length: newWidth }, () => 0)
    );

    for (let i = 0; i < Math.min(newHeight, prevField.length); i++) {
      for (let j = 0; j < Math.min(newWidth, prevField[i].length); j++) {
        updatedField[i][j] = prevField[i][j];
      }
    }

    return updatedField;
  },

  randomFill: (randomIndex, height, width) => {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => (Math.random() < randomIndex ? 1 : 0))
    );
  },

  get: (field, x, y) => field[y][x],

  set: (field, x, y, value) => {
    field[y][x] = value;
  },

  toBits: (field, width, height, out) => {
    const wordsPerRow = Math.ceil(width / 32);
    out.fill(0);
    for (let y = 0; y < height; y++) {
      const row = field[y];
      const base = y * wordsPerRow;
      for (let x = 0; x < width; x++) {
        if (row[x]) out[base + (x >>> 5)] |= 1 << (x & 31);
      }
    }
  },

  countNeighborsLimited: (field, x, y) => {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    let count = 0;
    const height = field.length;
    const width = field[0].length;
    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;
      if (newX >= 0 && newX < height && newY >= 0 && newY < width) {
        count += field[newX][newY];
      }
    }
    return count;
  },

  countNeighborsClosed: (field, x, y) => {
    const directions = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    let count = 0;
    const height = field.length;
    const width = field[0].length;
    for (const [dx, dy] of directions) {
      const newX = (x + dx + height) % height;
      const newY = (y + dy + width) % width;
      count += field[newX][newY];
    }
    return count;
  },

  makeAStep: (field, { wrap, birthRules, survivalRules }) => {
    const countNeighbors = wrap
      ? f_2dArray.countNeighborsClosed
      : f_2dArray.countNeighborsLimited;
    const height = field.length;
    const width = field[0].length;
    const newField: Field2d = [];
    let alive = 0;
    for (let i = 0; i < height; i++) {
      newField.push([]);
      for (let j = 0; j < width; j++) {
        const neighbors = countNeighbors(field, i, j);
        const newState = checkRules(
          field[i][j],
          neighbors,
          birthRules,
          survivalRules
        );
        newField[i][j] = newState;
        alive += newState;
      }
    }
    return { field: newField, alive };
  },

  paint: (field, pixels, aliveColor, deadColor) => {
    let p = 0;
    for (const row of field) {
      for (const cell of row) {
        pixels[p++] = cell ? aliveColor : deadColor;
      }
    }
  },

  countAliveCells: (field) => {
    return (
      field.reduce(
        (acc1, row) => acc1 + row.reduce((acc2, cell) => acc2 + cell, 0),
        0
      ) || 0
    );
  },

  memory: (width, height) => {
    const bytes =
      V8_ARRAY_BYTES +
      height * (V8_SLOT_BYTES + V8_ARRAY_BYTES + width * V8_SLOT_BYTES);
    return { bytes, perStep: bytes, estimated: true };
  },
} satisfies Engine<Field2d> & NeighborCounters<Field2d>;

export const f_1dArray = {
  generateField: (width, height) => {
    return Array.from({ length: width * height }, () => 0);
  },

  updateFieldDimensions: (
    prevField,
    newHeight,
    newWidth,
    prevHeight,
    prevWidth
  ) => {
    const updatedField = Array.from({ length: newHeight * newWidth }, () => 0);

    const minHeight = Math.min(newHeight, prevHeight);
    const minWidth = Math.min(newWidth, prevWidth);

    for (let i = 0; i < minHeight; i++) {
      for (let j = 0; j < minWidth; j++) {
        const newIndex = i * newWidth + j;
        const oldIndex = i * prevWidth + j;
        updatedField[newIndex] = prevField[oldIndex];
      }
    }

    return updatedField;
  },

  randomFill: (randomIndex, height, width) => {
    return Array.from({ length: height * width }, () =>
      Math.random() < randomIndex ? 1 : 0
    );
  },

  get: (field, x, y, width) => field[y * width + x],

  set: (field, x, y, value, width) => {
    field[y * width + x] = value;
  },

  toBits: (field, width, height, out) => {
    const wordsPerRow = Math.ceil(width / 32);
    out.fill(0);
    for (let y = 0; y < height; y++) {
      const offset = y * width;
      const base = y * wordsPerRow;
      for (let x = 0; x < width; x++) {
        if (field[offset + x]) out[base + (x >>> 5)] |= 1 << (x & 31);
      }
    }
  },

  countNeighborsLimited: (field, index, width) => {
    let count = 0;
    const isTopEdge = index < width;
    const isBottomEdge = index >= field.length - width;
    const isLeftEdge = index % width === 0;
    const isRightEdge = index % width === width - 1;

    const topLeft = index - width - 1;
    const top = index - width;
    const topRight = index - width + 1;
    const left = index - 1;
    const right = index + 1;
    const bottomLeft = index + width - 1;
    const bottom = index + width;
    const bottomRight = index + width + 1;

    if (!isTopEdge) {
      count += field[top];
      if (!isLeftEdge) count += field[topLeft];
      if (!isRightEdge) count += field[topRight];
    }

    if (!isLeftEdge) count += field[left];
    if (!isRightEdge) count += field[right];

    if (!isBottomEdge) {
      count += field[bottom];
      if (!isLeftEdge) count += field[bottomLeft];
      if (!isRightEdge) count += field[bottomRight];
    }

    return count;
  },

  countNeighborsClosed: (field, index, width) => {
    let count = 0;

    const top = (index - width + field.length) % field.length;
    const bottom = (index + width) % field.length;
    const left =
      ((index - 1 + width) % width) + width * Math.floor(index / width);
    const right = ((index + 1) % width) + width * Math.floor(index / width);

    const topLeft =
      ((top - 1 + width) % width) + width * Math.floor(top / width);
    const topRight = ((top + 1) % width) + width * Math.floor(top / width);
    const bottomLeft =
      ((bottom - 1 + width) % width) + width * Math.floor(bottom / width);
    const bottomRight =
      ((bottom + 1) % width) + width * Math.floor(bottom / width);

    const neighbors = [
      top,
      bottom,
      left,
      right,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    ];

    for (const neighbor of neighbors) {
      count += field[neighbor];
    }

    return count;
  },

  makeAStep: (field, { width, wrap, birthRules, survivalRules }) => {
    const countNeighbors = wrap
      ? f_1dArray.countNeighborsClosed
      : f_1dArray.countNeighborsLimited;
    const newField: Field1d = [];
    let alive = 0;

    for (let i = 0; i < field.length; i++) {
      const neighbors = countNeighbors(field, i, width);
      const newState = checkRules(
        field[i],
        neighbors,
        birthRules,
        survivalRules
      );
      newField[i] = newState;
      alive += newState;
    }

    return { field: newField, alive };
  },

  paint: (field, pixels, aliveColor, deadColor) => {
    for (let i = 0; i < field.length; i++) {
      pixels[i] = field[i] ? aliveColor : deadColor;
    }
  },

  countAliveCells: (field) => {
    return field.reduce((acc, cell) => acc + cell, 0) || 0;
  },

  memory: (width, height) => {
    const bytes = V8_ARRAY_BYTES + width * height * V8_SLOT_BYTES;
    return { bytes, perStep: bytes, estimated: true };
  },
} satisfies Engine<Field1d> & NeighborCounters<Field1d>;

const popcount = (v: number) => {
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};

const ruleKernels = new Map<string, RuleKernel>();

export const getRuleSource = (
  birthRules: number[],
  survivalRules: number[]
) => {
  const count = (n: number) =>
    [0, 1, 2, 3]
      .map((bit) => `${(n >> bit) & 1 ? '' : '~'}s${bit}`)
      .join(' & ');
  const anyOf = (rules: number[]) =>
    rules.length ? rules.map((n) => `(${count(n)})`).join(' | ') : '0';
  return `return (c & (${anyOf(survivalRules)})) | (~c & (${anyOf(
    birthRules
  )}));`;
};

export const getRuleKernel = (
  birthRules: number[],
  survivalRules: number[]
) => {
  const key = `${[...birthRules].sort().join('')}/${[...survivalRules]
    .sort()
    .join('')}`;
  if (!ruleKernels.has(key)) {
    ruleKernels.set(
      key,
      new Function(
        's0',
        's1',
        's2',
        's3',
        'c',
        getRuleSource(birthRules, survivalRules)
      ) as RuleKernel
    );
  }
  return ruleKernels.get(key)!;
};

export const f_bitArray = {
  generateField: (width, height) => {
    const wordsPerRow = Math.ceil(width / 32);
    return {
      width,
      height,
      wordsPerRow,
      cells: new Uint32Array(wordsPerRow * height),
      buffer: new Uint32Array(wordsPerRow * height),
    };
  },

  updateFieldDimensions: (prevField, newHeight, newWidth): BitField => {
    const field = f_bitArray.generateField(newWidth, newHeight);
    const height = Math.min(newHeight, prevField.height);
    const width = Math.min(newWidth, prevField.width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (f_bitArray.get(prevField, x, y)) f_bitArray.set(field, x, y, 1);
      }
    }
    return field;
  },

  randomFill: (randomIndex, height, width): BitField => {
    const field = f_bitArray.generateField(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.random() < randomIndex) f_bitArray.set(field, x, y, 1);
      }
    }
    return field;
  },

  get: (field, x, y) =>
    (field.cells[y * field.wordsPerRow + (x >>> 5)] >>> (x & 31)) & 1,

  set: (field, x, y, value) => {
    const index = y * field.wordsPerRow + (x >>> 5);
    if (value) field.cells[index] |= 1 << (x & 31);
    else field.cells[index] &= ~(1 << (x & 31));
  },

  toBits: (field, width, height, out) => {
    out.set(field.cells);
  },

  makeAStep: (field, { wrap, birthRules, survivalRules }) => {
    const { width, height, wordsPerRow, cells, buffer } = field;
    const rule = getRuleKernel(birthRules, survivalRules);
    const last = wordsPerRow - 1;
    const tail = width & 31;
    const tailMask = tail ? (1 << tail) - 1 : -1;
    const lastBit = (width - 1) & 31;
    let alive = 0;

    const read = (row: number, k: number) => {
      if (row < 0) return 0;
      const word = cells[row + k];
      return wrap && tail && k === last
        ? word | ((cells[row] & 1) << tail)
        : word;
    };

    const readPrev = (row: number, k: number) => {
      if (row < 0) return 0;
      if (k > 0) return cells[row + k - 1];
      return wrap ? ((cells[row + last] >>> lastBit) & 1) << 31 : 0;
    };

    const readNext = (row: number, k: number) => {
      if (row < 0) return 0;
      if (k < last) return cells[row + k + 1];
      return wrap && !tail ? cells[row] & 1 : 0;
    };

    for (let y = 0; y < height; y++) {
      const row = y * wordsPerRow;
      const up =
        y > 0 ? row - wordsPerRow : wrap ? (height - 1) * wordsPerRow : -1;
      const down = y < height - 1 ? row + wordsPerRow : wrap ? 0 : -1;

      for (let k = 0; k <= last; k++) {
        const a = read(up, k);
        const c = read(row, k);
        const b = read(down, k);
        const aL = (a << 1) | (readPrev(up, k) >>> 31);
        const aR = (a >>> 1) | (readNext(up, k) << 31);
        const cL = (c << 1) | (readPrev(row, k) >>> 31);
        const cR = (c >>> 1) | (readNext(row, k) << 31);
        const bL = (b << 1) | (readPrev(down, k) >>> 31);
        const bR = (b >>> 1) | (readNext(down, k) << 31);

        const a1 = aL ^ a ^ aR;
        const a2 = (aL & a) | (aR & (aL ^ a));
        const b1 = bL ^ b ^ bR;
        const b2 = (bL & b) | (bR & (bL ^ b));
        const c1 = cL ^ cR;
        const c2 = cL & cR;

        const s0 = a1 ^ b1 ^ c1;
        const carry0 = (a1 & b1) | (c1 & (a1 ^ b1));
        const twos = a2 ^ b2;
        const twosSum = twos ^ c2;
        const carryA = (a2 & b2) | (c2 & twos);
        const s1 = twosSum ^ carry0;
        const carryB = twosSum & carry0;
        const s2 = carryA ^ carryB;
        const s3 = carryA & carryB;

        let next = rule(s0, s1, s2, s3, c);
        if (k === last) next &= tailMask;
        buffer[row + k] = next;
        alive += popcount(next);
      }
    }

    field.cells = buffer;
    field.buffer = cells;
    return { field, alive };
  },

  paint: (field, pixels, aliveColor, deadColor) => {
    const { width, height, wordsPerRow, cells } = field;
    let p = 0;
    for (let y = 0; y < height; y++) {
      const row = y * wordsPerRow;
      for (let k = 0; k < wordsPerRow; k++) {
        let word = cells[row + k];
        const end = Math.min(32, width - k * 32);
        for (let j = 0; j < end; j++) {
          pixels[p++] = word & 1 ? aliveColor : deadColor;
          word >>>= 1;
        }
      }
    }
  },

  countAliveCells: (field) => {
    let alive = 0;
    for (let i = 0; i < field.cells.length; i++) alive += popcount(field.cells[i]);
    return alive;
  },

  memory: (width, height) => ({
    bytes: Math.ceil(width / 32) * height * Uint32Array.BYTES_PER_ELEMENT * 2,
    perStep: 0,
    estimated: false,
  }),
} satisfies Engine<BitField>;

export const convertField = <From extends Field, To extends Field>(
  from: Engine<From>,
  to: Engine<To>,
  field: From,
  width: number,
  height: number
) => {
  const result = to.generateField(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (from.get(field, x, y, width)) to.set(result, x, y, 1, width);
    }
  }
  return result;
};
