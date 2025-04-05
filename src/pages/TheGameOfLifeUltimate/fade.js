const TRAIL_STRENGTH = 0.6;

export const layerSize = (cols, rows) => Math.ceil(cols / 32) * rows;

export const recordLayer = (layers, depth, size, write) => {
  const layer = layers.length >= depth ? layers.pop() : new Uint32Array(size);
  write(layer);
  layers.unshift(layer);
};

const channel = (color, shift) => (color >>> shift) & 0xff;

const mix = (from, to, amount) => {
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

export const fadePalette = (aliveColor, deadColor, depth) =>
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
  current,
  layers,
  palette,
  deadColor,
  pixels,
  cols,
  rows
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
