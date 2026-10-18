import { fitRidge, predictRidge } from './ridge';
import { FEATURE_NOISE } from './features';

export const LAMBDAS = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1];

const average = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// Leave one group out: fit on everything else, predict the group. A group is one
// calibration point or one stretch of the pursuit path, so every sample is judged
// by a model that saw nothing near it — an honest error, unlike the fit's own.
export function crossValidate(samples, lambda) {
  const groups = [...new Set(samples.map((sample) => sample.group))];
  const heldOut = [];
  for (const group of groups) {
    const train = samples.filter((sample) => sample.group !== group);
    const test = samples.filter((sample) => sample.group === group);
    if (!train.length) continue;
    const model = fitRidge(
      train.map((sample) => sample.features),
      train.map((sample) => sample.target),
      FEATURE_NOISE,
      undefined,
      lambda
    );
    for (const sample of test) {
      heldOut.push({ sample, predicted: predictRidge(model, sample.features) });
    }
  }
  const error = average(
    heldOut.map(({ sample, predicted }) =>
      Math.hypot(predicted.x - sample.target.x, predicted.y - sample.target.y)
    )
  );
  return { error, heldOut };
}

// Tries every candidate sample set (e.g. one per guess of the eye's lag) with
// every lambda, and keeps the pair with the lowest held-out error.
export function selectModel(candidates) {
  let best = null;
  for (const candidate of candidates) {
    for (const lambda of LAMBDAS) {
      const result = crossValidate(candidate.samples, lambda);
      if (!best || result.error < best.error) {
        best = { ...candidate, lambda, ...result };
      }
    }
  }
  return best;
}

// Systematic miss per third of the screen (3×3), from the held-out predictions:
// the mean error vector, so jitter averages out and only the bias is left — the
// part that snapping and fixation averaging can't fix.
export function regionMisses(heldOut, width, height) {
  const cells = Array.from({ length: 9 }, () => ({ dx: 0, dy: 0, count: 0 }));
  for (const { sample, predicted } of heldOut) {
    const col = Math.min(Math.max(Math.floor((sample.client.x / width) * 3), 0), 2);
    const row = Math.min(Math.max(Math.floor((sample.client.y / height) * 3), 0), 2);
    const cell = cells[row * 3 + col];
    cell.dx += predicted.x - sample.target.x;
    cell.dy += predicted.y - sample.target.y;
    cell.count += 1;
  }
  return cells.map((cell) =>
    cell.count ? Math.hypot(cell.dx / cell.count, cell.dy / cell.count) : null
  );
}
