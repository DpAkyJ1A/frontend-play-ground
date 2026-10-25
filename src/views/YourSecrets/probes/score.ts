import type { ProbeResult } from './types';

export const values = (result: ProbeResult | undefined) =>
  result
    ? [
        result.guarded ? null : result.lead,
        ...result.facts.map(([, value]) => value),
      ]
    : [];

export const isShared = (value: string | null | undefined) =>
  value !== null && value !== undefined && value !== '';

export const shared = (result: ProbeResult | undefined) =>
  values(result).filter(isShared).length;

export const completeness = (result: ProbeResult | undefined) => {
  const all = values(result).length;
  return all ? shared(result) / all : 0;
};
