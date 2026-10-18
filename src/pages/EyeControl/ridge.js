// Ridge regression from eye features to a screen point. Features are standardized,
// so one lambda works for all of them; at predict time they are clamped, because a
// feature that barely moved during calibration (head position) must not explode later.

const CLAMP = 3.5;

function solve(matrix, vector) {
  const size = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < size; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= size; k++) a[row][k] -= factor * a[col][k];
    }
  }
  const result = new Array(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let sum = a[row][size];
    for (let k = row + 1; k < size; k++) sum -= a[row][k] * result[k];
    result[row] = sum / a[row][row];
  }
  return result;
}

// `weights` lets some samples count more than others (recent clicks over an old
// calibration); omitted, every sample counts once.
export function fitRidge(samples, targets, minStd, weights, lambda = 0.02) {
  const n = samples.length;
  const p = samples[0].length;
  const w = weights ?? new Array(n).fill(1);
  const total = w.reduce((sum, weight) => sum + weight, 0);
  const mean = new Array(p).fill(0);
  const std = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) mean[j] += (w[i] * samples[i][j]) / total;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      std[j] += (w[i] * (samples[i][j] - mean[j]) ** 2) / total;
    }
  }
  for (let j = 0; j < p; j++) std[j] = Math.max(Math.sqrt(std[j]), minStd[j]);

  const z = samples.map((sample) => sample.map((v, j) => (v - mean[j]) / std[j]));
  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < n; i++) {
    meanX += (w[i] * targets[i].x) / total;
    meanY += (w[i] * targets[i].y) / total;
  }

  const gram = Array.from({ length: p }, () => new Array(p).fill(0));
  const bx = new Array(p).fill(0);
  const by = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = z[i];
    const share = w[i] / total;
    for (let j = 0; j < p; j++) {
      bx[j] += row[j] * (targets[i].x - meanX) * share;
      by[j] += row[j] * (targets[i].y - meanY) * share;
      for (let k = 0; k < p; k++) gram[j][k] += row[j] * row[k] * share;
    }
  }
  for (let j = 0; j < p; j++) gram[j][j] += lambda;

  return {
    mean,
    std,
    wx: solve(gram, bx),
    wy: solve(gram, by),
    meanX,
    meanY,
  };
}

export function predictRidge(model, features) {
  let x = model.meanX;
  let y = model.meanY;
  for (let j = 0; j < features.length; j++) {
    const z = Math.max(
      -CLAMP,
      Math.min(CLAMP, (features[j] - model.mean[j]) / model.std[j])
    );
    x += model.wx[j] * z;
    y += model.wy[j] * z;
  }
  return { x, y };
}
