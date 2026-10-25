import type { Probe, ProbeContext, ProbeResult } from './types';
import { afterPaint, nextTask, withTimeout } from './utils';

const TIMEOUT = 4000;

export const FAILED: ProbeResult = { lead: null, facts: [], failed: true };

export const collect = async (
  probe: Probe,
  context: ProbeContext
): Promise<ProbeResult> => {
  try {
    return (await withTimeout(probe.collect(context), TIMEOUT)) ?? FAILED;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.warn(probe.id, error);
    return FAILED;
  }
};

export const runProbes = async (
  probes: Probe[],
  context: ProbeContext,
  onResult: (probe: Probe, result: ProbeResult) => void,
  signal?: AbortSignal
) => {
  const start = performance.now();
  const jobs: Promise<void>[] = [];
  const launch = (probe: Probe) =>
    jobs.push(
      collect(probe, context).then((result) => {
        if (!signal?.aborted) onResult(probe, result);
      })
    );
  for (const probe of probes.filter((p) => !p.heavy)) {
    launch(probe);
    await nextTask();
  }
  await afterPaint();
  for (const probe of probes.filter((p) => p.heavy)) {
    if (signal?.aborted) break;
    launch(probe);
    await nextTask();
  }
  await Promise.all(jobs);
  return performance.now() - start;
};
