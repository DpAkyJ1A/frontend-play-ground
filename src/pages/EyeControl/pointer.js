// Pointer logic on top of the gaze point: which element is aimed at, dwell clicks
// and blink gestures. No rendering here — the arena draws whatever this returns.

const STICKY_PX = 24;
const RELEASE_FACTOR = 1.3;
const SWITCH_MS = 120;
const BLINK_MIN_MS = 40;
const BLINK_MAX_MS = 450;
const BLINK_GAP_MS = 450;
const BLINK_RELEASE = 0.15;

const rectDistance = (rect, x, y) =>
  Math.hypot(
    Math.max(rect.left - x, 0, x - rect.right),
    Math.max(rect.top - y, 0, y - rect.bottom)
  );

export function nearestTarget(targets, point) {
  let target = null;
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
export function targetsWithin(targets, point, radius) {
  return [...targets].filter(
    (target) =>
      rectDistance(target.getBoundingClientRect(), point.x, point.y) <= radius
  );
}

// Snap to the nearest target within `radius`; keep the current one unless another
// is clearly closer, so the highlight doesn't flicker between neighbours.
export function snapTarget(targets, point, current, radius) {
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

export function hitTarget(point, selector) {
  return document.elementFromPoint(point.x, point.y)?.closest(selector) ?? null;
}

// A new target has to win several frames in a row before it takes over: one noisy
// frame next to a neighbour must not move the highlight or restart the dwell.
export function createAim() {
  let current = null;
  let pending = null;
  let pendingSince = 0;

  return {
    update(candidate, time) {
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
export function createDwell() {
  let target = null;
  let locked = null;
  let elapsed = 0;
  let lastTime = 0;

  return {
    update(next, time, duration, paused) {
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
    hold(next) {
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
  let target = null;

  return {
    update(blink, threshold, time, aimed) {
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
