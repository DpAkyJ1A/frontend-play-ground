import { fitRidge } from './ridge';
import { FEATURE_NOISE } from './features';

// Keeps the data the gaze model is fit on: the calibration, plus every click made
// with the eyes — you looked at the button you pressed, so the eye features of the
// frames before the click get its centre as the answer. Clicks outweigh the
// calibration and the newest outweigh the oldest, so when you shift in the chair
// the model follows within a few clicks instead of slowly going stale.

const DEFAULT_LAMBDA = 0.02;
const MAX_CLICKS = 40;
const CLICK_WEIGHT = 2;
const RECENT_CLICKS = 10;

const average = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function createTrainer() {
  let calibration = [];
  let clicks = [];
  let lambda = DEFAULT_LAMBDA;

  const fit = () => {
    const features = [];
    const targets = [];
    const weights = [];
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
    return fitRidge(features, targets, FEATURE_NOISE, weights, lambda);
  };

  return {
    // samples: [{ features, target }] with the target in screen coordinates;
    // lambda as picked by cross-validation, kept for the click refits too
    calibrate(samples, chosenLambda = DEFAULT_LAMBDA) {
      calibration = samples;
      lambda = chosenLambda;
      clicks = [];
      return fit();
    },
    // `miss` is how far the model was from the button before learning from it
    learn(features, target, miss) {
      clicks.push({ features, target, miss });
      if (clicks.length > MAX_CLICKS) clicks.shift();
      return fit();
    },
    forget() {
      clicks = [];
      return calibration.length ? fit() : null;
    },
    stats() {
      const recent = clicks.slice(-RECENT_CLICKS);
      return {
        clicks: clicks.length,
        recentMiss: recent.length
          ? average(recent.map((click) => click.miss))
          : null,
      };
    },
  };
}
