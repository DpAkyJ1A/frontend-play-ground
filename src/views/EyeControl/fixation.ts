// Fixation filter: while the eyes rest, the point is the mean of the samples since
// the fixation began (capped to a time window, so slow drift is still followed).
// Noise shrinks as σ/√n, so the longer you look, the steadier the point. A jump
// further than `radius` that holds for a few frames is a saccade: the old samples
// are dropped and the point lands on the new spot at once. Time is in ms.

import type { Point } from './gazeEngine';

type FixationParams = { radius: number; windowMs: number };
type Sample = Point & { time: number };

const CONFIRM_SAMPLES = 3;

const mean = (samples: Sample[]): Point => {
  let x = 0;
  let y = 0;
  for (const sample of samples) {
    x += sample.x;
    y += sample.y;
  }
  return { x: x / samples.length, y: y / samples.length };
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function createFixationFilter({
  radius = 100,
  windowMs = 1000,
}: Partial<FixationParams> = {}) {
  const params: FixationParams = { radius, windowMs };
  let samples: Sample[] = [];
  let outliers: Sample[] = [];

  return {
    filter(point: Point, time: number): Point {
      const sample = { x: point.x, y: point.y, time };
      if (!samples.length) {
        samples = [sample];
        return point;
      }

      const center = mean(samples);
      if (distance(point, center) > params.radius) {
        outliers.push(sample);
        if (outliers.length < CONFIRM_SAMPLES) return center;
        const landing = mean(outliers);
        if (distance(landing, center) > params.radius) {
          samples = outliers;
          outliers = [];
          return landing;
        }
      } else {
        outliers.push(sample);
      }

      // the outliers didn't agree on a new spot: they were noise of this fixation
      samples.push(...outliers);
      outliers = [];
      while (samples[0].time < time - params.windowMs) samples.shift();
      return mean(samples);
    },
    reset() {
      samples = [];
      outliers = [];
    },
    set(changes: Partial<FixationParams>) {
      Object.assign(params, changes);
    },
  };
}
