// The smooth-pursuit path: a bowtie — along the top edge, a diagonal down, along
// the bottom edge, a diagonal back up. The diagonals pass every height on the way,
// not just a few rows (vertical is the axis a webcam reads worst), and the edges
// keep the extremes covered. Slow enough for the eyes to follow without catch-up
// jumps (under 6°/s at laptop distance). Pursuit breaks down at the turns, so
// frames near them are left out.

import type { Features } from '../features';
import type { Point } from '../gazeEngine';
import type { CalibrationSample } from './samples';

export type PursuitPath = {
  width: number;
  height: number;
  duration: number;
  turnTimes: number[];
  at(ms: number): Point;
};

// an eye frame, stamped with the ms since the dot started moving
export type PursuitFrame = {
  motion: number;
  features: Features;
  origin: Point;
};

export const PURSUIT_SPEED = 260;
export const PURSUIT_HOLD_MS = 1000;
// corners of the path, as fractions of the screen inside the margins
const WAYPOINTS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [0, 0],
];
const MARGIN_X = 0.06;
const MARGIN_Y = 0.08;
// the eye needs a moment to lock on after the start and after every turn
const START_SKIP_MS = 400;
const TURN_SKIP_MS = 250;
const MAX_SAMPLES = 400;
// cross-validation holds out one third of the screen at a time (3×3)
const REGIONS = 3;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function createPursuitPath(width: number, height: number): PursuitPath {
  const left = width * MARGIN_X;
  const top = height * MARGIN_Y;
  const vertices = WAYPOINTS.map(([fx, fy]) => ({
    x: left + (width - left * 2) * fx,
    y: top + (height - top * 2) * fy,
  }));
  const lengths = [0];
  for (let i = 1; i < vertices.length; i++) {
    lengths.push(lengths[i - 1] + distance(vertices[i - 1], vertices[i]));
  }
  const total = lengths[lengths.length - 1];
  const duration = (total / PURSUIT_SPEED) * 1000;

  return {
    width,
    height,
    duration,
    turnTimes: lengths.slice(1, -1).map((length) => (length / PURSUIT_SPEED) * 1000),
    // ms since the dot started moving → position, clamped to the path
    at(ms) {
      const travelled =
        (Math.min(Math.max(ms, 0), duration) * PURSUIT_SPEED) / 1000;
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < travelled) i++;
      const t = (travelled - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
      return {
        x: vertices[i - 1].x + (vertices[i].x - vertices[i - 1].x) * t,
        y: vertices[i - 1].y + (vertices[i].y - vertices[i - 1].y) * t,
      };
    },
  };
}

// Training samples for one guess of the eye's lag: each frame is paired with where
// the dot was `lag` ms earlier. Thinned to a few hundred and grouped by the third
// of the screen they fall in, so cross-validation asks the model about a part of
// the screen it never saw — not about the next stretch of a row it already knows.
export function pursuitSamples(
  frames: PursuitFrame[],
  path: PursuitPath,
  lag: number
) {
  const usable = frames.filter((frame) => {
    const t = frame.motion - lag;
    return (
      t >= START_SKIP_MS &&
      t <= path.duration &&
      path.turnTimes.every((turn) => Math.abs(t - turn) > TURN_SKIP_MS)
    );
  });
  const region = (value: number, extent: number) =>
    Math.min(Math.max(Math.floor((value / extent) * REGIONS), 0), REGIONS - 1);
  const stride = Math.max(1, usable.length / MAX_SAMPLES);
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < usable.length; i += stride) {
    const frame = usable[Math.floor(i)];
    const client = path.at(frame.motion - lag);
    samples.push({
      features: frame.features,
      client,
      target: { x: client.x + frame.origin.x, y: client.y + frame.origin.y },
      group:
        region(client.y, path.height) * REGIONS + region(client.x, path.width),
    });
  }
  return samples;
}
