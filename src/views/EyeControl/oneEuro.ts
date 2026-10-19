// One Euro filter (Casiez et al., 2012): heavy smoothing while the gaze rests,
// almost no lag once it jumps. Time is in seconds.

type OneEuroParams = { minCutoff: number; beta: number; dCutoff: number };

const smoothingFactor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export function createOneEuro({
  minCutoff = 1,
  beta = 0,
  dCutoff = 1,
}: Partial<OneEuroParams> = {}) {
  const params: OneEuroParams = { minCutoff, beta, dCutoff };
  let value: number | null = null;
  let speed = 0;
  let lastTime = 0;

  return {
    filter(next: number, time: number) {
      if (value === null) {
        value = next;
        lastTime = time;
        return value;
      }
      const dt = Math.max(time - lastTime, 1e-3);
      lastTime = time;
      speed += smoothingFactor(params.dCutoff, dt) * ((next - value) / dt - speed);
      const cutoff = params.minCutoff + params.beta * Math.abs(speed);
      value += smoothingFactor(cutoff, dt) * (next - value);
      return value;
    },
    reset() {
      value = null;
      speed = 0;
    },
    set(changes: Partial<OneEuroParams>) {
      Object.assign(params, changes);
    },
  };
}
