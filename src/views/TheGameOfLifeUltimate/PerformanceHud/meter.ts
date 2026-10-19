// Running totals since the last read, decayed after every read.
export type PerfSample = {
  fresh: number;
  frames: number;
  frameTime: number;
  capped: number;
  loops: number;
  steps: number;
  stepTime: number;
  paintTime: number;
};

// Average milliseconds per frame.
export type PerfFrame = { step: number; paint: number; total: number };

export type PerfReading = {
  fps: number;
  genPerSecond: number;
  hasSteps: boolean;
  stepCost: number;
  stepCostFloor: number;
  paintCost: number;
  paintCostFloor: number;
  budget: number;
  cappedShare: number;
  frame: PerfFrame;
};

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

export const createPerfSample = (): PerfSample => ({
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
  sample: PerfSample,
  frameTime: number,
  steps: number,
  stepTime: number,
  paintTime: number,
  capped: boolean
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

export const readPerfSample = (
  sample: PerfSample,
  resolution: number,
  budget: number
): PerfReading | null => {
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
