// The smooth-pursuit path: a snake over four rows, slow enough for the eyes to
// follow without catch-up jumps (~6°/s at laptop distance). Pursuit breaks down
// at the turns, so frames near them are left out.

export const PURSUIT_SPEED = 280;
export const PURSUIT_HOLD_MS = 1000;
// rows visited out of order, so height on screen doesn't grow with time: a slow
// slump in the chair would otherwise pass for looking further down
const ROW_ORDER = [0, 2, 1, 3];
const MARGIN_X = 0.06;
const MARGIN_Y = 0.08;
// the eye needs a moment to lock on after the start and after every turn
const START_SKIP_MS = 400;
const TURN_SKIP_MS = 250;
const MAX_SAMPLES = 400;
const GROUPS = 10;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createPursuitPath(width, height) {
  const left = width * MARGIN_X;
  const right = width * (1 - MARGIN_X);
  const top = height * MARGIN_Y;
  const bottom = height * (1 - MARGIN_Y);

  const vertices = [];
  ROW_ORDER.forEach((row, i) => {
    const y = top + ((bottom - top) * row) / (ROW_ORDER.length - 1);
    const [from, to] = i % 2 ? [right, left] : [left, right];
    vertices.push({ x: from, y }, { x: to, y });
  });
  const lengths = [0];
  for (let i = 1; i < vertices.length; i++) {
    lengths.push(lengths[i - 1] + distance(vertices[i - 1], vertices[i]));
  }
  const total = lengths[lengths.length - 1];
  const duration = (total / PURSUIT_SPEED) * 1000;

  return {
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
// the dot was `lag` ms earlier. Thinned to a few hundred, split into stretches of
// the path for cross-validation.
export function pursuitSamples(frames, path, lag) {
  const usable = frames.filter((frame) => {
    const t = frame.motion - lag;
    return (
      t >= START_SKIP_MS &&
      t <= path.duration &&
      path.turnTimes.every((turn) => Math.abs(t - turn) > TURN_SKIP_MS)
    );
  });
  const stride = Math.max(1, usable.length / MAX_SAMPLES);
  const samples = [];
  for (let i = 0; i < usable.length; i += stride) {
    const frame = usable[Math.floor(i)];
    const t = frame.motion - lag;
    const client = path.at(t);
    samples.push({
      features: frame.features,
      client,
      target: { x: client.x + frame.origin.x, y: client.y + frame.origin.y },
      group: Math.min(Math.floor((t / path.duration) * GROUPS), GROUPS - 1),
    });
  }
  return samples;
}
