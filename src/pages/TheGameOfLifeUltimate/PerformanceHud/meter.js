const DECAY = 0.8;

let timerResolution = 0;

export const getTimerResolution = () => {
  if (timerResolution) return timerResolution;
  let previous = performance.now();
  const end = previous + 20;
  let smallest = Infinity;
  let ticks = 0;
  while (ticks < 10 && previous < end) {
    const now = performance.now();
    if (now === previous) continue;
    smallest = Math.min(smallest, now - previous);
    previous = now;
    ticks += 1;
  }
  timerResolution = Number.isFinite(smallest) ? smallest : 1;
  return timerResolution;
};

export const createPerfSample = () => ({
  fresh: 0,
  frames: 0,
  frameTime: 0,
  capped: 0,
  loops: 0,
  steps: 0,
  stepTime: 0,
  paintTime: 0,
});

export const recordFrame = (
  sample,
  frameTime,
  steps,
  stepTime,
  paintTime,
  capped
) => {
  sample.fresh += 1;
  sample.frames += 1;
  sample.frameTime += frameTime;
  if (capped) sample.capped += 1;
  if (!steps) return;
  sample.loops += 1;
  sample.steps += steps;
  sample.stepTime += stepTime;
  sample.paintTime += paintTime;
};

export const readPerfSample = (sample, resolution, budget) => {
  const { frames, frameTime, capped, loops, steps, stepTime, paintTime } =
    sample;
  if (!sample.fresh || frameTime <= 0) return null;
  sample.fresh = 0;

  const reading = {
    fps: (frames * 1000) / frameTime,
    genPerSecond: (steps * 1000) / frameTime,
    hasSteps: loops > 0,
    stepCost: steps ? stepTime / steps : 0,
    stepCostFloor: steps ? (resolution * Math.sqrt(loops)) / steps : 0,
    paintCost: loops ? paintTime / loops : 0,
    paintCostFloor: loops ? resolution / Math.sqrt(loops) : 0,
    budget: stepTime / frames / budget,
    cappedShare: capped / frames,
    frame: {
      step: stepTime / frames,
      paint: paintTime / frames,
      total: frameTime / frames,
    },
  };

  sample.frames *= DECAY;
  sample.frameTime *= DECAY;
  sample.capped *= DECAY;
  sample.loops *= DECAY;
  sample.steps *= DECAY;
  sample.stepTime *= DECAY;
  sample.paintTime *= DECAY;
  return reading;
};
