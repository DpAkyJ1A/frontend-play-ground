import { useCallback, useEffect, useState } from 'react';
import { PROBES } from './probes';
import { collect, runProbes } from './probes/run';
import type { ProbeContext, ProbeResult } from './probes/types';

const LIVE_EVERY = 1000;

export const useProbes = ({ hasServer }: ProbeContext) => {
  const [results, setResults] = useState<ReadonlyMap<string, ProbeResult>>(
    () => new Map()
  );
  const [elapsed, setElapsed] = useState<number | null>(null);

  const setResult = useCallback((id: string, result: ProbeResult) => {
    setResults((previous) => new Map(previous).set(id, result));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const stops = PROBES.flatMap((probe) =>
      probe.watch && !probe.watchWhenSettled ? [probe.watch()] : []
    );
    runProbes(
      PROBES,
      { hasServer },
      (probe, result) => setResult(probe.id, result),
      controller.signal
    ).then((ms) => {
      if (!controller.signal.aborted) setElapsed(ms);
    });
    return () => {
      controller.abort();
      for (const stop of stops) stop();
    };
  }, [hasServer, setResult]);

  useEffect(() => {
    if (elapsed === null) return;
    let active = true;
    const stops = PROBES.flatMap((probe) =>
      probe.watch && probe.watchWhenSettled ? [probe.watch()] : []
    );
    const live = PROBES.filter((probe) => probe.live);
    const timer = setInterval(async () => {
      for (const probe of live) {
        const result = await collect(probe, { hasServer });
        if (active) setResult(probe.id, result);
      }
    }, LIVE_EVERY);
    return () => {
      active = false;
      clearInterval(timer);
      for (const stop of stops) stop();
    };
  }, [elapsed, hasServer, setResult]);

  return { results, elapsed, setResult };
};
