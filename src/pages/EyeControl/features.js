// Turns one MediaPipe face mesh frame into the feature vector the gaze model is fit on.
// Indices are from the 478-point mesh (468+ are the refined iris points). Both eye
// axes run left to right in the image, so the two eyes give comparable numbers.
const EYES = [
  { from: 33, to: 133, upper: 159, lower: 145, iris: 468 },
  { from: 362, to: 263, upper: 386, lower: 374, iris: 473 },
];

export const DEBUG_POINTS = [33, 133, 362, 263, 468, 473];

// The least a feature must vary during calibration to be trusted, in its own units
// (roughly its frame-to-frame noise). Without this, a feature that only moved by
// noise — head position while sitting still — gets standardized up to the size of
// a real signal, and the fit turns that noise into cursor jitter.
export const FEATURE_NOISE = [
  0.01, 0.01, 0.001, 0.001, 0.001, 0.01, 0.03, 0.03, 0.5, 0.5, 1,
];

export function extractFeatures(landmarks, matrix, width, height) {
  let h = 0;
  let v = 0;
  let open = 0;

  for (const eye of EYES) {
    const a = landmarks[eye.from];
    const b = landmarks[eye.to];
    const iris = landmarks[eye.iris];
    const upper = landmarks[eye.upper];
    const lower = landmarks[eye.lower];

    const dx = (b.x - a.x) * width;
    const dy = (b.y - a.y) * height;
    const eyeWidth = Math.hypot(dx, dy);
    const ux = dx / eyeWidth;
    const uy = dy / eyeWidth;
    const ox = (iris.x - (a.x + b.x) / 2) * width;
    const oy = (iris.y - (a.y + b.y) / 2) * height;

    // iris offset from the eye centre, along the eye axis and across it
    h += (ox * ux + oy * uy) / eyeWidth / 2;
    v += (oy * ux - ox * uy) / eyeWidth / 2;
    open +=
      Math.hypot((upper.x - lower.x) * width, (upper.y - lower.y) * height) /
      eyeWidth /
      2;
  }

  // column-major 4×4: column 2 is the face's forward axis, column 3 its position
  const m = matrix?.data;
  const head = m ? [m[8], m[9], m[12], m[13], m[14]] : [0, 0, 0, 0, 0];

  return [h, v, h * h, v * v, h * v, open, ...head];
}
