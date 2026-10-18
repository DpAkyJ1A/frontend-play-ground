const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// drop frames where the eyes were elsewhere (a glance away, a late saccade)
export const trimOutliers = (samples) => {
  if (samples.length < 4) return samples;
  const axes = [0, 1].map((axis) => {
    const values = samples.map((sample) => sample.features[axis]);
    const center = median(values);
    const spread = median(values.map((value) => Math.abs(value - center)));
    return { center, limit: spread * 3 + 1e-4 };
  });
  return samples.filter((sample) =>
    axes.every(
      ({ center, limit }, axis) =>
        Math.abs(sample.features[axis] - center) <= limit
    )
  );
};

// pairs of eye features and the dot they looked at, in screen coordinates
export const fixationSamples = (target, frames, group) =>
  trimOutliers(frames).map((frame) => ({
    features: frame.features,
    client: target,
    target: { x: target.x + frame.origin.x, y: target.y + frame.origin.y },
    group,
  }));
