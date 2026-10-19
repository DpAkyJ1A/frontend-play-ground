// Pointer logic on top of the gaze point: which element is aimed at, dwell clicks
// and blink gestures. No rendering here — the arena draws whatever this returns.

import type { Point } from './gazeEngine';

export type Direction = 'up' | 'down' | 'left' | 'right';

const STICKY_PX = 24;
const RELEASE_FACTOR = 1.3;
const SWITCH_MS = 120;
const BLINK_MIN_MS = 40;
const BLINK_MAX_MS = 450;
const BLINK_GAP_MS = 450;
const BLINK_RELEASE = 0.15;

const rectDistance = (rect: DOMRect, x: number, y: number) =>
  Math.hypot(
    Math.max(rect.left - x, 0, x - rect.right),
    Math.max(rect.top - y, 0, y - rect.bottom)
  );

export function nearestTarget(targets: Iterable<HTMLElement>, point: Point) {
  let target: HTMLElement | null = null;
  let distance = Infinity;
  for (const candidate of targets) {
    const candidateDistance = rectDistance(
      candidate.getBoundingClientRect(),
      point.x,
      point.y
    );
    if (candidateDistance < distance) {
      target = candidate;
      distance = candidateDistance;
    }
  }
  return { target, distance };
}

// Every target within `radius` of the point: with more than one, the gaze alone
// can't tell which is meant.
export function targetsWithin(
  targets: Iterable<HTMLElement>,
  point: Point,
  radius: number
) {
  return [...targets].filter(
    (target) =>
      rectDistance(target.getBoundingClientRect(), point.x, point.y) <= radius
  );
}

// one step of a nudge, by direction
export const NUDGE_STEPS: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const centre = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

// The nearest target in a direction from `from`: its centre has to lie within
// 45° of that direction, and sideways distance counts double, so "right" is the
// next one along the row rather than one diagonally below it.
export function neighborIn(
  targets: Iterable<HTMLElement>,
  from: HTMLElement,
  direction: Direction
) {
  const step = NUDGE_STEPS[direction];
  const origin = centre(from.getBoundingClientRect());
  let best: HTMLElement | null = null;
  let bestCost = Infinity;
  for (const target of targets) {
    if (target === from) continue;
    const point = centre(target.getBoundingClientRect());
    const along = (point.x - origin.x) * step.x + (point.y - origin.y) * step.y;
    const across = Math.abs(
      (point.x - origin.x) * step.y - (point.y - origin.y) * step.x
    );
    if (along <= 0 || across > along) continue;
    const cost = along + across * 2;
    if (cost < bestCost) {
      best = target;
      bestCost = cost;
    }
  }
  return best;
}

// Snap to the nearest target within `radius`; keep the current one unless another
// is clearly closer, so the highlight doesn't flicker between neighbours.
export function snapTarget(
  targets: Iterable<HTMLElement>,
  point: Point,
  current: HTMLElement | null,
  radius: number
) {
  const { target: best, distance: bestDistance } = nearestTarget(targets, point);

  if (current?.isConnected) {
    const distance = rectDistance(
      current.getBoundingClientRect(),
      point.x,
      point.y
    );
    if (
      distance <= radius * RELEASE_FACTOR &&
      !(bestDistance + STICKY_PX < distance)
    ) {
      return current;
    }
  }
  return bestDistance <= radius ? best : null;
}

export function hitTarget(point: Point, selector: string) {
  return (
    document
      .elementFromPoint(point.x, point.y)
      ?.closest<HTMLElement>(selector) ?? null
  );
}

// A new target has to win several frames in a row before it takes over: one noisy
// frame next to a neighbour must not move the highlight or restart the dwell.
export function createAim() {
  let current: HTMLElement | null = null;
  let pending: HTMLElement | null = null;
  let pendingSince = 0;

  return {
    update(candidate: HTMLElement | null, time: number) {
      if (candidate === current) {
        pending = null;
      } else if (candidate !== pending) {
        pending = candidate;
        pendingSince = time;
      } else if (time - pendingSince >= SWITCH_MS) {
        current = candidate;
        pending = null;
      }
      return current;
    },
  };
}

// After a dwell click the target stays locked until the gaze leaves it — otherwise
// simply reading a button you just pressed would press it again.
// `T` is what the gaze rests on: a button, or a spot on the page.
export function createDwell<T>() {
  let target: T | null = null;
  let locked: T | null = null;
  let elapsed = 0;
  let lastTime = 0;

  return {
    update(
      next: T | null,
      time: number,
      duration: number,
      paused: boolean | null
    ) {
      const dt = lastTime ? time - lastTime : 0;
      lastTime = time;
      if (next !== target) {
        target = next;
        elapsed = 0;
        locked = null;
      } else if (target && target !== locked && !paused) {
        elapsed += dt;
      }
      if (target && target !== locked && elapsed >= duration) {
        locked = target;
        return { progress: 1, fire: target };
      }
      return {
        progress: target === locked ? 0 : Math.max(0, elapsed) / duration,
        fire: null,
      };
    },
    // treat `next` as just clicked: nothing fires on it until the gaze moves on
    hold(next: T | null) {
      target = next;
      locked = next;
      elapsed = 0;
    },
  };
}

// Counts quick blinks (both eyes) into a sequence; when the eyes stay open for a
// moment the sequence ends and is reported with the target aimed at when it began.
// A long closure (resting the eyes) cancels the sequence.
export function createBlinkGestures() {
  let closed = false;
  let closedAt = 0;
  let openedAt = 0;
  let count = 0;
  let target: HTMLElement | null = null;

  return {
    update(
      blink: number,
      threshold: number,
      time: number,
      aimed: HTMLElement | null
    ) {
      if (!closed && blink > threshold) {
        closed = true;
        closedAt = time;
        if (count === 0) target = aimed;
      } else if (closed && blink < threshold - BLINK_RELEASE) {
        closed = false;
        openedAt = time;
        const duration = time - closedAt;
        count =
          duration >= BLINK_MIN_MS && duration <= BLINK_MAX_MS ? count + 1 : 0;
      }

      if (!closed && count > 0 && time - openedAt > BLINK_GAP_MS) {
        const gesture = { count, target };
        count = 0;
        return { gesture, pending: 0 };
      }
      return { gesture: null, pending: count + (closed ? 1 : 0) };
    },
  };
}
