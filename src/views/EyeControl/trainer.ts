import { fitRidge, predictRidge, type RidgeModel } from './ridge';
import { FEATURE_NOISE, type Features } from './features';
import type { Point } from './gazeEngine';

// Keeps the data the gaze model is fit on: the calibration, plus every click made
// with the eyes — you looked at the button you pressed, so the eye features of the
// frames before the click get its centre as the answer. Clicks outweigh the
// calibration and the newest outweigh the oldest, so when you shift in the chair
// the model follows within a few clicks instead of slowly going stale.
//
// A drift check (one dot, looked at for a second) shifts the whole model so that
// dot lands where it should: a slump in the chair moves everything at once. The
// shift is recomputed after every refit, so once clicks have absorbed the drift
// there is nothing left to add — and after a few more clicks the check is old
// news and is dropped.

export type TrainingSample = { features: Features; target: Point };
type Click = { features: Features[]; target: Point; miss: number };
type Drift = {
  features: Features[];
  target: Point;
  clicksSince: number;
  shift: number;
};

export type LearningStats = {
  clicks: number;
  recentMiss: number | null;
  recentred: number | null;
};

const DEFAULT_LAMBDA = 0.02;
const MAX_CLICKS = 40;
const CLICK_WEIGHT = 2;
const RECENT_CLICKS = 10;
const DRIFT_CLICKS = 10;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// how far the model puts the frames from `target`, on average
const missVector = (
  model: RidgeModel,
  features: Features[],
  target: Point
) => {
  const predicted = features.map((frame) => predictRidge(model, frame));
  return {
    x: target.x - average(predicted.map((point) => point.x)),
    y: target.y - average(predicted.map((point) => point.y)),
  };
};

export function createTrainer() {
  let calibration: TrainingSample[] = [];
  let clicks: Click[] = [];
  let lambda = DEFAULT_LAMBDA;
  // the last drift check: { features, target, clicksSince, shift }
  let drift: Drift | null = null;

  const fit = (): RidgeModel => {
    const features: Features[] = [];
    const targets: Point[] = [];
    const weights: number[] = [];
    for (const sample of calibration) {
      features.push(sample.features);
      targets.push(sample.target);
      weights.push(1);
    }
    clicks.forEach((click, i) => {
      const weight = CLICK_WEIGHT * (0.5 + (0.5 * (i + 1)) / clicks.length);
      for (const frame of click.features) {
        features.push(frame);
        targets.push(click.target);
        weights.push(weight);
      }
    });
    const model = fitRidge(features, targets, FEATURE_NOISE, weights, lambda);
    if (!drift) return model;
    const { x, y } = missVector(model, drift.features, drift.target);
    return { ...model, meanX: model.meanX + x, meanY: model.meanY + y };
  };

  return {
    // samples: [{ features, target }] with the target in screen coordinates;
    // lambda as picked by cross-validation, kept for the click refits too
    calibrate(samples: TrainingSample[], chosenLambda = DEFAULT_LAMBDA) {
      calibration = samples;
      lambda = chosenLambda;
      clicks = [];
      drift = null;
      return fit();
    },
    // features: the frames spent on a dot at `target` (screen coordinates)
    recentre(features: Features[], target: Point) {
      drift = null;
      // how far off the model is at the dot: the shift the check applies
      const { x, y } = missVector(fit(), features, target);
      drift = { features, target, clicksSince: 0, shift: Math.hypot(x, y) };
      return fit();
    },
    // `miss` is how far the model was from the button before learning from it
    learn(features: Features[], target: Point, miss: number) {
      clicks.push({ features, target, miss });
      if (clicks.length > MAX_CLICKS) clicks.shift();
      if (drift && ++drift.clicksSince > DRIFT_CLICKS) drift = null;
      return fit();
    },
    forget() {
      clicks = [];
      return calibration.length ? fit() : null;
    },
    stats(): LearningStats {
      const recent = clicks.slice(-RECENT_CLICKS);
      return {
        clicks: clicks.length,
        recentMiss: recent.length
          ? average(recent.map((click) => click.miss))
          : null,
        recentred: drift?.shift ?? null,
      };
    },
  };
}
