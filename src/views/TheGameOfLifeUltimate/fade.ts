const TRAIL_STRENGTH = 0.6;

export const layerSize = (cols: number, rows: number) =>
  Math.ceil(cols / 32) * rows;

// `depth` is at least 1 here, so a full stack always has a layer to reuse.
export const recordLayer = (
  layers: Uint32Array[],
  depth: number,
  size: number,
  write: (layer: Uint32Array) => void
) => {
  const layer = layers.length >= depth ? layers.pop()! : new Uint32Array(size);
  write(layer);
  layers.unshift(layer);
};

const channel = (color: number, shift: number) => (color >>> shift) & 0xff;

const mix = (from: number, to: number, amount: number) => {
  let color = 0xff000000;
  for (const shift of [0, 8, 16]) {
    const value = Math.round(
      channel(from, shift) +
        (channel(to, shift) - channel(from, shift)) * amount
    );
    color |= value << shift;
  }
  return color >>> 0;
};

export const fadePalette = (
  aliveColor: number,
  deadColor: number,
  depth: number
) =>
  Uint32Array.from({ length: depth + 1 }, (_, age) =>
    age
      ? mix(
          deadColor,
          aliveColor,
          (TRAIL_STRENGTH * (depth + 1 - age)) / (depth + 1)
        )
      : aliveColor
  );

export const paintFaded = (
  current: Uint32Array,
  layers: Uint32Array[],
  palette: Uint32Array,
  deadColor: number,
  pixels: Uint32Array,
  cols: number,
  rows: number
) => {
  const wordsPerRow = Math.ceil(cols / 32);
  const count = layers.length;
  let p = 0;
  for (let y = 0; y < rows; y++) {
    const row = y * wordsPerRow;
    for (let k = 0; k < wordsPerRow; k++) {
      const index = row + k;
      const end = Math.min(32, cols - k * 32);
      const alive = current[index];
      let seen = alive;
      for (let l = 0; l < count; l++) seen |= layers[l][index];
      if (!seen) {
        pixels.fill(deadColor, p, p + end);
        p += end;
        continue;
      }
      for (let j = 0; j < end; j++) {
        const bit = 1 << j;
        let color = deadColor;
        if (alive & bit) {
          color = palette[0];
        } else if (seen & bit) {
          for (let l = 0; l < count; l++) {
            if (layers[l][index] & bit) {
              color = palette[l + 1];
              break;
            }
          }
        }
        pixels[p++] = color;
      }
    }
  }
};
