// Face gestures that nudge the pointer when the gaze lands next to what you mean:
// eyebrows up ↑, jaw dropped ↓, mouth pulled to one side ← →. None of them moves
// the eyes, so the gaze stays on the real target the whole time — which is what
// makes the corrected spot worth learning from.

export const GESTURES = [
  { key: 'brows', label: 'Eyebrows up', arrow: '↑', threshold: 0.6, holdMs: 120 },
  { key: 'jaw', label: 'Jaw drop', arrow: '↓', threshold: 0.45, holdMs: 200 },
  { key: 'side', label: 'Mouth to a side', arrow: '← →', threshold: 0.35, holdMs: 120 },
];

// a held gesture re-arms once it relaxes below this share of its threshold
const RELEASE = 0.7;
// counts as "mid-gesture" for learning from this share of the threshold up
const STARTING = 0.5;
const REPEAT_MS = 450;
// how far the mouth has to move off its resting place to tell left from right
const MIN_SHIFT = 0.015;
const BASELINE_RATE = 0.05;
const SIDE = GESTURES.find((gesture) => gesture.key === 'side');

const score = (shapes, name) =>
  shapes?.categories.find((category) => category.categoryName === name)
    ?.score ?? 0;

// Gesture levels in one frame: blendshape scores, plus which way the mouth went.
// The way is read from the landmarks, not from the mouthLeft / mouthRight names,
// so a mirrored camera or a naming convention can't flip it. `shift` is the
// mouth's centre against the base of the nose, along the line between the eyes,
// in eye-spans; positive is towards the person's own left — the screen's left
// as they face it (33 → 263 runs left to right in the unmirrored camera image).
export function readFace(shapes, landmarks, width, height) {
  const at = (index) => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height,
  });
  const right = at(33);
  const left = at(263);
  const span = Math.hypot(left.x - right.x, left.y - right.y);
  const a = at(61);
  const b = at(291);
  const base = at(2);
  const shift =
    (((a.x + b.x) / 2 - base.x) * (left.x - right.x) +
      ((a.y + b.y) / 2 - base.y) * (left.y - right.y)) /
    span ** 2;

  return {
    brows: Math.max(
      score(shapes, 'browInnerUp'),
      (score(shapes, 'browOuterUpLeft') + score(shapes, 'browOuterUpRight')) / 2
    ),
    jaw: score(shapes, 'jawOpen'),
    side: Math.max(score(shapes, 'mouthLeft'), score(shapes, 'mouthRight')),
    shift,
  };
}

const thresholdOf = (gesture, sensitivity) => gesture.threshold / sensitivity;

// Raised brows drag the eyelids and the iris points with them: frames from the
// start of any gesture aren't trusted as eye data.
export const isGesturing = (face, sensitivity) =>
  GESTURES.some(
    (gesture) => face[gesture.key] >= thresholdOf(gesture, sensitivity) * STARTING
  );

// Turns levels into nudges: the strongest gesture past its threshold fires once
// it has been held for a moment (a syllable's jaw drop is shorter), then again
// every REPEAT_MS while it's held.
export function createFaceGestures() {
  let held = null;
  let baseline = null;

  return {
    // → 'up' | 'down' | 'left' | 'right' | null
    update(face, time, sensitivity) {
      if (!face) {
        held = null;
        return null;
      }
      // the relaxed mouth isn't centred on every face: compare with its own rest
      if (face.side < thresholdOf(SIDE, sensitivity) * STARTING) {
        baseline =
          baseline === null
            ? face.shift
            : baseline + (face.shift - baseline) * BASELINE_RATE;
      }

      if (
        held &&
        face[held.gesture.key] < thresholdOf(held.gesture, sensitivity) * RELEASE
      ) {
        held = null;
      }
      if (!held) {
        let best = null;
        for (const gesture of GESTURES) {
          const ratio = face[gesture.key] / thresholdOf(gesture, sensitivity);
          if (ratio >= 1 && (!best || ratio > best.ratio)) {
            best = { gesture, ratio };
          }
        }
        if (!best) return null;
        held = { gesture: best.gesture, since: time, firedAt: null };
      }

      if (time - held.since < held.gesture.holdMs) return null;
      if (held.firedAt !== null && time - held.firedAt < REPEAT_MS) return null;

      let direction = { brows: 'up', jaw: 'down' }[held.gesture.key];
      if (held.gesture === SIDE) {
        const moved = face.shift - (baseline ?? 0);
        if (Math.abs(moved) < MIN_SHIFT) return null;
        direction = moved > 0 ? 'left' : 'right';
      }
      held.firedAt = time;
      return direction;
    },
  };
}
